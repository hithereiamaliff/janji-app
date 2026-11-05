import { type CalClient, unwrap } from "@janji/cal-api/client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads the start times out of a GET /v2/slots body: `{ data: { "2026-11-06": [{ start }, …] } }`. The spec
 * describes each slot as a bare string, while API v2 sends `{ start }` objects (with seat counts for seated
 * event types), so both are read.
 */
export function slotStarts(body: unknown): string[] {
  if (!isRecord(body) || !isRecord(body.data)) return [];
  const starts: string[] = [];
  for (const daySlots of Object.values(body.data)) {
    if (!Array.isArray(daySlots)) continue;
    const slots: unknown[] = daySlots;
    for (const slot of slots) {
      if (typeof slot === "string") starts.push(slot);
      else if (isRecord(slot) && typeof slot.start === "string") starts.push(slot.start);
    }
  }
  return starts.sort((a, b) => Date.parse(a) - Date.parse(b));
}

export type RescheduleSlotsRequest = {
  eventTypeId: number;
  /** The booking being moved, so its own time counts as free. */
  uid: string;
  /** Cal.diy keeps a rescheduled booking's length, so slots are looked for at that length. */
  durationMinutes: number;
  from: Date;
  to: Date;
  /** The zone API v2 writes the times in. They're read back as instants, so it only affects formatting. */
  timeZone: string;
};

/** Start times (ISO 8601) a booking could move to, earliest first. */
export async function fetchRescheduleSlots(
  client: CalClient,
  { eventTypeId, uid, durationMinutes, from, to, timeZone }: RescheduleSlotsRequest
): Promise<string[]> {
  const result = await client.GET("/v2/slots", {
    params: {
      query: {
        eventTypeId,
        bookingUidToReschedule: uid,
        duration: durationMinutes,
        start: from.toISOString(),
        end: to.toISOString(),
        timeZone,
      },
    },
  });
  // The spec types this body as the date-to-slots map itself, but API v2 wraps it in its usual envelope, so it's
  // read as unknown and checked instead.
  const body: unknown = unwrap(result);
  return slotStarts(body);
}

export type RescheduleRequest = {
  /** ISO 8601 start of the new time. */
  start: string;
  /**
   * The host's email. Without it Cal.diy treats the change as the attendee's, and a booking that needs
   * confirmation goes back to waiting for it.
   */
  rescheduledBy: string;
  reason?: string;
};

/** Moves a booking to a new time and returns the uid of the booking Cal.diy creates for it. */
export async function rescheduleBooking(
  client: CalClient,
  uid: string,
  { start, rescheduledBy, reason }: RescheduleRequest
): Promise<string> {
  const body = unwrap(
    await client.POST("/v2/bookings/{bookingUid}/reschedule", {
      params: { path: { bookingUid: uid } },
      body: {
        start: new Date(start).toISOString(),
        rescheduledBy,
        reschedulingReason: reason?.trim() || undefined,
      },
    })
  );
  return body.data.uid;
}
