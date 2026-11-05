import type { Alert } from "./alert";

// https://docs.expo.dev/push-notifications/sending-notifications/
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
// Expo answers up to 1000 receipts at a time.
const MAX_RECEIPTS = 1000;
// Receipts are usually ready sooner, but Expo suggests waiting 15 minutes before asking, and clears them after a day.
const RECEIPT_DELAY_MS = 15 * 60 * 1000;
const RECEIPT_LIFETIME_MS = 24 * 60 * 60 * 1000;

type ExpoOutcome = { status?: unknown; id?: unknown; details?: unknown };

function headers(env: Cloudflare.Env): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    // Only needed once "enhanced push security" is turned on for the Expo project.
    ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Whether Apple or Google say the phone can't get notifications any more, such as after an uninstall. */
function deviceGone(outcome: ExpoOutcome): boolean {
  return isRecord(outcome.details) && outcome.details.error === "DeviceNotRegistered";
}

async function forgetDevice(env: Cloudflare.Env, deviceId: string): Promise<void> {
  await env.DB.prepare("DELETE FROM devices WHERE id = ?").bind(deviceId).run();
}

/**
 * Sends the alert to the phone through Expo, keeping the ticket to check its receipt later. A phone Expo
 * already knows is gone is forgotten, so its webhook gets 410 from then on.
 */
export async function sendAlert(
  env: Cloudflare.Env,
  device: { id: string; push_token: string },
  alert: Alert
): Promise<void> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: headers(env),
    // Sent as a list, so the tickets always come back as one.
    body: JSON.stringify([{ to: device.push_token, ...alert, sound: "default", priority: "high" }]),
  });
  if (!response.ok) throw new Error(`Expo refused the push with ${response.status}`);
  const body: unknown = await response.json();
  // A list of messages gets a list of tickets back; one message on its own gets one ticket.
  const data = isRecord(body) ? body.data : undefined;
  const ticket: unknown = Array.isArray(data) ? data[0] : data;
  if (!isRecord(ticket)) throw new Error("Expo answered the push without a ticket");

  if (ticket.status === "ok" && typeof ticket.id === "string") {
    await env.DB.prepare("INSERT INTO push_tickets (id, device_id, created_at) VALUES (?, ?, ?)")
      .bind(ticket.id, device.id, Date.now())
      .run();
  } else if (deviceGone(ticket)) {
    await forgetDevice(env, device.id);
  }
}

/**
 * Asks Expo for the receipts of tickets old enough to have one, forgets phones Expo couldn't reach, and drops
 * tickets that are done with: those with a receipt, and those older than Expo keeps receipts.
 */
export async function checkReceipts(env: Cloudflare.Env, now: number = Date.now()): Promise<void> {
  await env.DB.prepare("DELETE FROM push_tickets WHERE created_at < ?")
    .bind(now - RECEIPT_LIFETIME_MS)
    .run();
  const { results: tickets } = await env.DB.prepare(
    "SELECT id, device_id FROM push_tickets WHERE created_at <= ? ORDER BY created_at LIMIT ?"
  )
    .bind(now - RECEIPT_DELAY_MS, MAX_RECEIPTS)
    .all<{ id: string; device_id: string }>();
  if (tickets.length === 0) return;

  const response = await fetch(EXPO_RECEIPTS_URL, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({ ids: tickets.map((ticket) => ticket.id) }),
  });
  if (!response.ok) throw new Error(`Expo refused the receipts request with ${response.status}`);
  const body: unknown = await response.json();
  const receipts = isRecord(body) && isRecord(body.data) ? body.data : {};

  const statements: D1PreparedStatement[] = [];
  for (const ticket of tickets) {
    const receipt = receipts[ticket.id];
    // No receipt yet: asked again next time, until Expo would have cleared it.
    if (!isRecord(receipt)) continue;
    statements.push(
      deviceGone(receipt)
        ? env.DB.prepare("DELETE FROM devices WHERE id = ?").bind(ticket.device_id)
        : env.DB.prepare("DELETE FROM push_tickets WHERE id = ?").bind(ticket.id)
    );
  }
  if (statements.length > 0) await env.DB.batch(statements);
}
