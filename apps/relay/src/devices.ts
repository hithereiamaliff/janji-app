import type { RegisterDeviceRequest, RegisterDeviceResponse, RelayError } from "@janji/shared/relay";
import { Hono } from "hono";

import { encryptSecret, randomToken, sha256 } from "./crypto";

const PUSH_TOKEN = /^Expo(?:nent)?PushToken\[[^\]\s]{1,200}\]$/;
const LOCALE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8}){0,4}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRegistration(body: unknown): RegisterDeviceRequest | null {
  if (!isRecord(body)) return null;
  const { expoPushToken, platform, locale } = body;
  if (typeof expoPushToken !== "string" || !PUSH_TOKEN.test(expoPushToken)) return null;
  if (platform !== "ios" && platform !== "android") return null;
  if (typeof locale !== "string" || !LOCALE.test(locale)) return null;
  return { expoPushToken, platform, locale };
}

const error = (code: RelayError["error"]): RelayError => ({ error: code });

export const devices = new Hono<{ Bindings: Cloudflare.Env }>();

devices.post("/", async (c) => {
  // Registering is the only route that creates anything, so it's the one kept from being flooded.
  const { success } = await c.env.REGISTER_LIMIT.limit({
    key: c.req.header("CF-Connecting-IP") ?? "unknown",
  });
  if (!success) return c.json(error("rate_limited"), 429);

  const registration = readRegistration(await c.req.json().catch(() => null));
  if (!registration) return c.json(error("invalid_request"), 400);

  const deviceToken = randomToken();
  const webhookSecret = randomToken();
  const now = Date.now();
  // The same push token keeps its device, and with it the hook URL a Cal.diy webhook already points at; it
  // only gets new credentials, which is what happens when the app is reinstalled.
  const row = await c.env.DB.prepare(
    `INSERT INTO devices (id, push_token, platform, locale, token_hash, webhook_secret, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
     ON CONFLICT (push_token) DO UPDATE SET
       platform = excluded.platform,
       locale = excluded.locale,
       token_hash = excluded.token_hash,
       webhook_secret = excluded.webhook_secret,
       updated_at = excluded.updated_at
     RETURNING id, created_at`
  )
    .bind(
      randomToken(16),
      registration.expoPushToken,
      registration.platform,
      registration.locale,
      await sha256(deviceToken),
      await encryptSecret(webhookSecret, c.env.SECRETS_KEY),
      now
    )
    .first<{ id: string; created_at: number }>();
  if (!row) throw new Error("Registering the device returned no row");

  const response: RegisterDeviceResponse = {
    deviceId: row.id,
    deviceToken,
    hookUrl: `${new URL(c.req.url).origin}/v1/hooks/${row.id}`,
    webhookSecret,
  };
  return c.json(response, row.created_at === now ? 201 : 200);
});
