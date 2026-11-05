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
  location: string | null;
  meetingUrl: string | null;
  isRecurring: boolean;
};

export function toBookingSummary(booking: ApiBooking): BookingSummary {
  return {
    uid: booking.uid,
    title: booking.title,
    start: booking.start,
    end: booking.end,
    status: booking.status,
    attendees: booking.attendees.map(({ name, email }) => ({ name, email })),
    // API v2 sends an empty string rather than omitting the location.
    location: booking.location || null,
    meetingUrl: booking.meetingUrl || null,
    isRecurring: "recurringBookingUid" in booking,
  };
}
