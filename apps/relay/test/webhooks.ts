// Webhook bodies the way Cal.diy builds them, for the relay's tests.

export type WebhookOptions = {
  trigger?: string;
  createdAt?: string;
  uid?: string;
  recurring?: boolean;
  requiresConfirmation?: boolean;
  attendee?: string | null;
};

export function webhookBody({
  trigger = "BOOKING_CREATED",
  createdAt = new Date().toISOString(),
  uid = "booking-1",
  recurring = false,
  requiresConfirmation = false,
  attendee = "Jane",
}: WebhookOptions = {}): string {
  return JSON.stringify({
    triggerEvent: trigger,
    createdAt,
    payload: {
      type: "consultation",
      title: "Consultation between Alan and Jane",
      eventTitle: "Consultation",
      startTime: "2026-11-12T07:00:00.000Z",
      endTime: "2026-11-12T08:00:00.000Z",
      organizer: { name: "Alan", email: "alan@example.com", timeZone: "Asia/Kuala_Lumpur" },
      attendees: attendee ? [{ name: attendee, email: "jane@example.com", timeZone: "Europe/London" }] : [],
      uid,
      requiresConfirmation,
      ...(recurring ? { recurringEvent: { freq: 2, count: 4, interval: 1 } } : {}),
    },
  });
}

/** The X-Cal-Signature-256 Cal.diy would send: the body's HMAC-SHA256 with the secret, as hex. */
export async function signature(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return [...mac].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
