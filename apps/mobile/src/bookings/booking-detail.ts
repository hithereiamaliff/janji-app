import type { components } from "@janji/cal-api/schema";

import { API_PLACEHOLDER, type ApiBooking, type BookingSummary, toBookingSummary } from "./booking";

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
  /** The booker's additional notes: Cal.diy saves the `notes` answer as the booking's description. */
  description: string | null;
  durationMinutes: number;
  hosts: BookingPerson[];
  /** The booker and their guests, whom Cal.diy adds as attendees. */
  attendees: BookingPerson[];
  answers: BookingAnswer[];
  cancellationReason: string | null;
  reschedulingReason: string | null;
  eventTypeId: number;
};

// Answers the detail screen shows in their own place (people, notes, location, reasons, the title), plus
// displayEmail and displayGuests, which API v2 adds as copies of email and guests.
const FIELDS_SHOWN_ELSEWHERE = new Set([
  "name",
  "email",
  "displayEmail",
  "attendeePhoneNumber",
  "guests",
  "displayGuests",
  "notes",
  "location",
  "title",
  "rescheduleReason",
  "rescheduledReason",
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

// API v2 reports only the reason it stored itself (`rescheduledReason`), while the web booker saves it as the
// `rescheduleReason` answer. When it can't read a booking's answers, it reports its placeholder instead.
function reschedulingReason(booking: ApiBooking, responses: Record<string, unknown>): string | null {
  const reported = textOrNull(booking.reschedulingReason);
  if (reported === API_PLACEHOLDER) return null;
  const answered = responses.rescheduleReason;
  return reported ?? (typeof answered === "string" ? textOrNull(answered) : null);
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
    // displayEmail drops the alias API v2 adds to some addresses, leaving the one people actually use.
    hosts: booking.hosts.map((host) => ({
      name: host.name,
      email: host.displayEmail,
      timeZone: host.timeZone,
      phoneNumber: null,
      noShow: booking.absentHost,
    })),
    attendees: booking.attendees.map((attendee) => ({
      name: attendee.name,
      email: attendee.displayEmail,
      timeZone: attendee.timeZone,
      phoneNumber: textOrNull(attendee.phoneNumber),
      noShow: attendee.absent,
    })),
    answers: bookingAnswers(responses),
    cancellationReason: textOrNull(booking.cancellationReason),
    reschedulingReason: reschedulingReason(booking, responses),
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
