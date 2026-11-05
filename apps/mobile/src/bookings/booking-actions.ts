import { type CalClient, unwrap } from "@janji/cal-api/client";
import type { components } from "@janji/cal-api/schema";

import { type ApiBookingResult, type BookingDetail, pickBooking, toBookingDetail } from "./booking-detail";

// Every action answers with the booking as it now stands, or with the whole series for recurring bookings.
function updatedBooking(data: ApiBookingResult, uid: string): BookingDetail | null {
  const booking = pickBooking(data, uid);
  return booking ? toBookingDetail(booking) : null;
}

/** Confirms an unconfirmed booking. For a recurring booking, Cal.diy confirms the whole series. */
export async function confirmBooking(client: CalClient, uid: string): Promise<BookingDetail | null> {
  const body = unwrap(
    await client.POST("/v2/bookings/{bookingUid}/confirm", { params: { path: { bookingUid: uid } } })
  );
  return updatedBooking(body.data, uid);
}

/** Declines an unconfirmed booking; Cal.diy sends the reason, if any, to the attendees. */
export async function declineBooking(
  client: CalClient,
  uid: string,
  reason?: string
): Promise<BookingDetail | null> {
  const body = unwrap(
    await client.POST("/v2/bookings/{bookingUid}/decline", {
      params: { path: { bookingUid: uid } },
      body: { reason: reason?.trim() || undefined },
    })
  );
  return updatedBooking(body.data, uid);
}

export type CancelBookingRequest = {
  /** Cal.diy requires one from the host unless the event type makes it optional. */
  reason: string;
  /** For a recurring booking: also cancel the occurrences after this one. */
  includeLaterOccurrences?: boolean;
};

export async function cancelBooking(
  client: CalClient,
  uid: string,
  { reason, includeLaterOccurrences = false }: CancelBookingRequest
): Promise<BookingDetail | null> {
  const body = unwrap(
    await client.POST("/v2/bookings/{bookingUid}/cancel", {
      params: { path: { bookingUid: uid } },
      body: {
        cancellationReason: reason.trim(),
        ...(includeLaterOccurrences ? { cancelSubsequentBookings: true } : {}),
      },
    })
  );
  return updatedBooking(body.data, uid);
}

export type NoShowChange = {
  /** The attendee's `email` as Cal.diy stores it, not the display address. */
  email: string;
  noShow: boolean;
};

/** Marks attendees as no-shows, or clears the mark. Cal.diy only allows this once the booking has started. */
export async function markNoShow(
  client: CalClient,
  uid: string,
  changes: NoShowChange[]
): Promise<BookingDetail | null> {
  const body = unwrap(
    await client.POST("/v2/bookings/{bookingUid}/mark-absent", {
      params: { path: { bookingUid: uid } },
      body: { attendees: changes.map(({ email, noShow }) => ({ email, absent: noShow })) },
    })
  );
  return updatedBooking(body.data, uid);
}

export type NewGuest = {
  email: string;
  name?: string;
};

type ApiGuest = components["schemas"]["Guest"];

/** Cal.diy accepts up to 10 guests per request and 30 attendees per booking. */
export const MAX_GUESTS_PER_REQUEST = 10;

/** Adds guests to the booking. Cal.diy adds them as attendees and emails each an invitation. */
export async function addGuests(
  client: CalClient,
  uid: string,
  guests: NewGuest[]
): Promise<BookingDetail | null> {
  const body = unwrap(
    await client.POST("/v2/bookings/{bookingUid}/guests", {
      params: { path: { bookingUid: uid } },
      // The spec marks language (of the guest's emails) as required, though the server falls back to
      // English. The app can't know a new guest's language, so it sends that same fallback.
      body: {
        guests: guests.map(
          ({ email, name }): ApiGuest => ({
            email: email.trim(),
            name: name?.trim() || undefined,
            language: "en",
          })
        ),
      },
    })
  );
  return updatedBooking(body.data, uid);
}
