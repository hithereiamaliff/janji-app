// Reading Cal.diy's webhooks. Cal.diy sends `{ triggerEvent, createdAt, payload }` as JSON and signs the raw body
// with HMAC-SHA256 in X-Cal-Signature-256, as hex (packages/features/webhooks/lib/sendPayload.ts).

const encoder = new TextEncoder();

/** The booking events the app subscribes its webhooks to. */
export const BOOKING_TRIGGERS = [
  "BOOKING_CREATED",
  "BOOKING_REQUESTED",
  "BOOKING_RESCHEDULED",
  "BOOKING_CANCELLED",
] as const;

export type BookingTrigger = (typeof BOOKING_TRIGGERS)[number];

/** What an alert needs from a booking webhook; the rest of the payload is never kept. */
export type BookingWebhook = {
  trigger: BookingTrigger;
  createdAt: number;
  uid: string;
  /** The event type's name, which reads better than the booking's long title. */
  eventTitle: string;
  start: string;
  /** The organizer's time zone, which the start is shown in. */
  timeZone: string;
  attendeeName: string | null;
  /** Confirming a booking that needed it fires BOOKING_CREATED too. */
  requiresConfirmation: boolean;
  /** A recurring series fires once for each booking in it, with nothing to tie them together but this. */
  recurring: boolean;
  /** For a reschedule, the booking it replaces, which is the one the app moved if the move was made there. */
  rescheduledFrom: string | null;
};

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}

/** Whether `signature` is the body's HMAC with the secret. `crypto.subtle.verify` compares in constant time. */
export async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  const expected = hexToBytes(signature);
  if (!expected) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify("HMAC", key, expected, encoder.encode(body));
}

// Cal.diy sends a booking's webhooks while it handles the booking, so an older one is a replay.
const MAX_AGE_MS = 10 * 60 * 1000;

/** Whether a webhook created at `createdAt` is recent enough to act on, allowing for clocks that disagree a little. */
export function isFresh(createdAt: number, now: number): boolean {
  return Math.abs(now - createdAt) <= MAX_AGE_MS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * The booking webhook in a body, "other" for a well-formed webhook about something else, or null for a body
 * that isn't one.
 */
export function readBookingWebhook(body: string): BookingWebhook | "other" | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !isRecord(parsed.payload)) return null;
  const createdAt = typeof parsed.createdAt === "string" ? Date.parse(parsed.createdAt) : Number.NaN;
  if (typeof parsed.triggerEvent !== "string" || Number.isNaN(createdAt)) return null;
  const trigger = BOOKING_TRIGGERS.find((each) => each === parsed.triggerEvent);
  if (!trigger) return "other";

  const { payload } = parsed;
  const uid = text(payload.uid);
  const start = text(payload.startTime);
  const timeZone = isRecord(payload.organizer) ? text(payload.organizer.timeZone) : null;
  const eventTitle = text(payload.eventTitle) ?? text(payload.title);
  if (!uid || !start || Number.isNaN(Date.parse(start)) || !timeZone || !eventTitle) return null;
  const attendees: unknown[] = Array.isArray(payload.attendees) ? payload.attendees : [];
  const firstAttendee = attendees[0];

  return {
    trigger,
    createdAt,
    uid,
    eventTitle,
    start,
    timeZone,
    attendeeName: isRecord(firstAttendee) ? text(firstAttendee.name) : null,
    requiresConfirmation: payload.requiresConfirmation === true,
    recurring: isRecord(payload.recurringEvent),
    rescheduledFrom: trigger === "BOOKING_RESCHEDULED" ? text(payload.rescheduleUid) : null,
  };
}
