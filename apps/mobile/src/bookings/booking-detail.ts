import type { components } from "@janji/cal-api/schema";

import { type ApiBooking, type BookingSummary, toBookingSummary } from "./booking";

/** GET /v2/bookings/{uid}'s `data`: one booking, or every occurrence when the uid names a recurring series. */
export type ApiBookingResult = components["schemas"]["GetBookingOutput_2024_08_13"]["data"];

export type BookingPerson = {
  name: string;
  email: string;
  timeZone: string | null;
  phoneNumber: string | null;
  /** Marked as a no-show on this booking. */
  noShow: boolean;
};

/** An answer to one of the event type's booking questions, keyed by the question's field name. */
export type BookingAnswer = {
  field: string;
  value: string | boolean;
};

export type BookingDetail = Omit<BookingSummary, "attendees"> & {
  description: string | null;
  durationMinutes: number;
  hosts: BookingPerson[];
  attendees: BookingPerson[];
  guests: string[];
  answers: BookingAnswer[];
  cancellationReason: string | null;
  reschedulingReason: string | null;
  eventTypeId: number;
};

// Answers the detail screen already shows in its own place (people, location, reasons, the title).
const FIELDS_SHOWN_ELSEWHERE = new Set([
  "name",
  "email",
  "location",
  "guests",
  "rescheduleReason",
  "attendeePhoneNumber",
  "title",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOrNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Booking question answers arrive as strings, lists, yes/no values or `{ value }` objects (phone, radio). */
function answerValue(value: unknown): string | boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return textOrNull(value);
  if (Array.isArray(value)) {
    const items = value.map(answerValue).filter((item): item is string => typeof item === "string");
    return items.length > 0 ? items.join(", ") : null;
  }
  if (isRecord(value) && typeof value.value === "string") return textOrNull(value.value);
  return null;
}

/** The answers worth showing, in the order the questions were asked. */
export function bookingAnswers(responses: Record<string, unknown>): BookingAnswer[] {
  const answers: BookingAnswer[] = [];
  for (const [field, raw] of Object.entries(responses)) {
    if (FIELDS_SHOWN_ELSEWHERE.has(field)) continue;
    const value = answerValue(raw);
    if (value !== null) answers.push({ field, value });
  }
  return answers;
}

/** Picks the requested booking when API v2 answers with a whole recurring series. */
export function pickBooking(data: ApiBookingResult, uid: string): ApiBooking | undefined {
  if (!Array.isArray(data)) return data;
  return data.find((booking) => booking.uid === uid) ?? data[0];
}

export function toBookingDetail(booking: ApiBooking): BookingDetail {
  // Seated bookings keep answers per seat rather than on the booking.
  const responses: Record<string, unknown> =
    "bookingFieldsResponses" in booking ? booking.bookingFieldsResponses : {};

  return {
    ...toBookingSummary(booking),
    description: textOrNull(booking.description),
    durationMinutes: booking.duration,
    hosts: booking.hosts.map((host) => ({
      name: host.name,
      email: host.email,
      timeZone: host.timeZone,
      phoneNumber: null,
      noShow: booking.absentHost,
    })),
    attendees: booking.attendees.map((attendee) => ({
      name: attendee.name,
      email: attendee.email,
      timeZone: attendee.timeZone,
      phoneNumber: textOrNull(attendee.phoneNumber),
      noShow: attendee.absent,
    })),
    guests: "guests" in booking ? (booking.guests ?? []) : [],
    answers: bookingAnswers(responses),
    cancellationReason: textOrNull(booking.cancellationReason),
    reschedulingReason: textOrNull(booking.reschedulingReason),
    eventTypeId: booking.eventTypeId,
  };
}

/** A readable label for a custom question's field name, e.g. "arrival-date" → "Arrival date". */
export function fieldNameLabel(field: string): string {
  const words = field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
