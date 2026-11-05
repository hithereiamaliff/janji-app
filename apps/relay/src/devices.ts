import type {
  DeviceStatusResponse,
  RegisterDeviceRequest,
  RegisterDeviceResponse,
  RelayError,
  UpdateDeviceRequest,
} from "@janji/shared/relay";
import { type Context, Hono } from "hono";

import { encryptSecret, randomToken, sha256 } from "./crypto";

const PUSH_TOKEN = /^Expo(?:nent)?PushToken\[[^\]\s]{1,200}\]$/;
const LOCALE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8}){0,4}$/;
const DEVICE_ID = /^[\w-]{22}$/;
// D1 binds at most 100 values to one query.
const MAX_STATUS_IDS = 100;

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

function readUpdate(body: unknown): UpdateDeviceRequest | null {
  if (!isRecord(body)) return null;
  const { expoPushToken, locale } = body;
  if (expoPushToken === undefined && locale === undefined) return null;
  if (expoPushToken !== undefined && (typeof expoPushToken !== "string" || !PUSH_TOKEN.test(expoPushToken))) {
    return null;
  }
  if (locale !== undefined && (typeof locale !== "string" || !LOCALE.test(locale))) return null;
  return { expoPushToken, locale };
}

function readDeviceIds(body: unknown): string[] | null {
  if (!isRecord(body) || !Array.isArray(body.deviceIds)) return null;
  const ids: unknown[] = body.deviceIds;
  if (ids.length === 0 || ids.length > MAX_STATUS_IDS) return null;
  return ids.every((id): id is string => typeof id === "string" && DEVICE_ID.test(id)) ? ids : null;
}

const error = (code: RelayError["error"]): RelayError => ({ error: code });

type DevicesContext = Context<{ Bindings: Cloudflare.Env }>;

/** The device a request is for, if its Bearer token is that device's; otherwise the response to give. */
async function ownDevice(c: DevicesContext, id: string): Promise<{ id: string } | Response> {
  const token = /^Bearer (\S+)$/.exec(c.req.header("Authorization") ?? "")?.[1];
  if (!token) return c.json(error("unauthorized"), 401);
  const row = await c.env.DB.prepare("SELECT id, token_hash FROM devices WHERE id = ?")
    .bind(id)
    .first<{ id: string; token_hash: string }>();
  if (!row) return c.json(error("not_found"), 404);
  if (row.token_hash !== (await sha256(token))) return c.json(error("unauthorized"), 401);
  return { id: row.id };
}

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

devices.patch("/:id", async (c) => {
  const device = await ownDevice(c, c.req.param("id"));
  if (device instanceof Response) return device;
  const update = readUpdate(await c.req.json().catch(() => null));
  if (!update) return c.json(error("invalid_request"), 400);

  if (update.expoPushToken) {
    const holder = await c.env.DB.prepare("SELECT id FROM devices WHERE push_token = ? AND id != ?")
      .bind(update.expoPushToken, device.id)
      .first<{ id: string }>();
    // Another device has this token, so the app registers again, which takes that device over.
    if (holder) return c.json(error("push_token_taken"), 409);
  }
  await c.env.DB.prepare(
    `UPDATE devices SET push_token = COALESCE(?1, push_token), locale = COALESCE(?2, locale), updated_at = ?3
     WHERE id = ?4`
  )
    .bind(update.expoPushToken ?? null, update.locale ?? null, Date.now(), device.id)
    .run();
  return c.body(null, 204);
});

devices.delete("/:id", async (c) => {
  const device = await ownDevice(c, c.req.param("id"));
  if (device instanceof Response) return device;
  await c.env.DB.prepare("DELETE FROM devices WHERE id = ?").bind(device.id).run();
  return c.body(null, 204);
});

// IDs are 128 random bits, so answering which exist gives nothing away, and needs no device token.
devices.post("/status", async (c) => {
  const ids = readDeviceIds(await c.req.json().catch(() => null));
  if (!ids) return c.json(error("invalid_request"), 400);
  const rows = await c.env.DB.prepare(`SELECT id FROM devices WHERE id IN (${ids.map(() => "?").join(", ")})`)
    .bind(...ids)
    .all<{ id: string }>();
  const known = new Set(rows.results.map((row) => row.id));
  const response: DeviceStatusResponse = { known: ids.filter((id) => known.has(id)) };
  return c.json(response);
});
