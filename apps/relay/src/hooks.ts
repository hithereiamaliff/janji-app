import type { RelayError } from "@janji/shared/relay";
import { Hono } from "hono";

import { alertFor, dedupeKey } from "./alert";
import { decryptSecret } from "./crypto";
import { sendAlert } from "./expo";
import { type BookingWebhook, isFresh, readBookingWebhook, verifySignature } from "./webhook";

// Cal.diy's booking payloads are a few kilobytes, so anything much bigger isn't one.
const MAX_BODY_BYTES = 256 * 1024;
// Covers a webhook sent twice, and a recurring series' bookings, which Cal.diy sends together.
const DEDUPE_SECONDS = 10 * 60;

type HookDevice = { id: string; push_token: string; locale: string; webhook_secret: string };

const error = (code: RelayError["error"]): RelayError => ({ error: code });

async function notify(env: Cloudflare.Env, device: HookDevice, webhook: BookingWebhook): Promise<void> {
  const key = `dedupe:${dedupeKey(device.id, webhook)}`;
  if (await env.DEDUPE.get(key)) return;
  await env.DEDUPE.put(key, "1", { expirationTtl: DEDUPE_SECONDS });
  await sendAlert(env, device.push_token, alertFor(webhook, device.locale));
}

export const hooks = new Hono<{ Bindings: Cloudflare.Env }>();

// The body is never stored or logged: once the alert is written, the booking's details are gone.
hooks.post("/:deviceId", async (c) => {
  const device = await c.env.DB.prepare(
    "SELECT id, push_token, locale, webhook_secret FROM devices WHERE id = ?"
  )
    .bind(c.req.param("deviceId"))
    .first<HookDevice>();
  // Gone for good. Cal.diy ignores the status, but it tells anyone checking the hook that it can stop.
  if (!device) return c.json(error("not_found"), 410);

  if (Number(c.req.header("Content-Length") ?? 0) > MAX_BODY_BYTES)
    return c.json(error("invalid_request"), 413);
  const body = await c.req.text();
  if (body.length > MAX_BODY_BYTES) return c.json(error("invalid_request"), 413);
  const secret = await decryptSecret(device.webhook_secret, c.env.SECRETS_KEY);
  if (!(await verifySignature(secret, body, c.req.header("X-Cal-Signature-256") ?? ""))) {
    return c.json(error("unauthorized"), 401);
  }

  const webhook = readBookingWebhook(body);
  if (webhook === null) return c.json(error("invalid_request"), 400);
  if (webhook === "other") return c.json({ ok: true });
  if (!isFresh(webhook.createdAt, Date.now())) return c.json(error("invalid_request"), 400);

  // Cal.diy waits for this answer while the person books, so the push is sent after answering.
  c.executionCtx.waitUntil(notify(c.env, device, webhook));
  return c.json({ ok: true });
});
