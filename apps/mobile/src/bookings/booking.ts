import type { components } from "@janji/cal-api/schema";

type Schemas = components["schemas"];

/** Every shape GET /v2/bookings can return; they all share the fields a summary needs. */
export type ApiBooking =
  | Schemas["BookingOutput_2024_08_13"]
  | Schemas["RecurringBookingOutput_2024_08_13"]
  | Schemas["GetSeatedBookingOutput_2024_08_13"]
  | Schemas["GetRecurringSeatedBookingOutput_2024_08_13"];

export type BookingStatus = "accepted" | "pending" | "cancelled" | "rejected";

export type BookingAttendee = {
  name: string;
  email: string;
};

/**
 * A booking as list screens need it. Times stay ISO 8601 strings so cached data remains plain JSON and
 * formatting happens in the viewer's time zone at render time.
 */
export type BookingSummary = {
  uid: string;
  title: string;
  start: string;
  end: string;
  status: BookingStatus;
  attendees: BookingAttendee[];
  /** A meeting link, an address, a phone number or a conferencing app id such as `integrations:daily`. */
  location: string | null;
  isRecurring: boolean;
};

/** What API v2 sends in place of a value it couldn't read from the booking's stored data. */
export const API_PLACEHOLDER = "unknown";

export function toBookingSummary(booking: ApiBooking): BookingSummary {
  return {
    uid: booking.uid,
    title: booking.title,
    start: booking.start,
    end: booking.end,
    status: booking.status,
    attendees: booking.attendees.map(({ name, email }) => ({ name, email })),
    // API v2 sends an empty string for no location, and its placeholder when the booking's metadata
    // couldn't be read. Its `meetingUrl` is a deprecated copy of `location`.
    location: booking.location && booking.location !== API_PLACEHOLDER ? booking.location : null,
    isRecurring: "recurringBookingUid" in booking,
  };
}
