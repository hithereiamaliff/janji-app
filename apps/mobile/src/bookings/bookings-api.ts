import { type CalClient, unwrap } from "@janji/cal-api/client";

import { type BookingSummary, toBookingSummary } from "./booking";

export const BOOKING_FILTERS = ["upcoming", "unconfirmed", "past", "cancelled"] as const;
export type BookingFilter = (typeof BOOKING_FILTERS)[number];

export const BOOKINGS_PAGE_SIZE = 20;

export type BookingsPage = {
  bookings: BookingSummary[];
  /** The page to request next, or null when this was the last one. */
  nextPage: number | null;
};

// Upcoming and unconfirmed bookings read soonest first; past and cancelled ones most recent first.
const START_ORDER: Record<BookingFilter, "asc" | "desc"> = {
  upcoming: "asc",
  unconfirmed: "asc",
  past: "desc",
  cancelled: "desc",
};

export type BookingsPageRequest = {
  filter: BookingFilter;
  /** Zero-based page number. */
  page: number;
  /** Matches attendee names on the server. */
  search?: string;
};

export async function fetchBookingsPage(
  client: CalClient,
  { filter, page, search }: BookingsPageRequest
): Promise<BookingsPage> {
  const attendeeName = search?.trim() || undefined;
  const body = unwrap(
    await client.GET("/v2/bookings", {
      params: {
        query: {
          status: [filter],
          sortStart: START_ORDER[filter],
          take: BOOKINGS_PAGE_SIZE,
          skip: page * BOOKINGS_PAGE_SIZE,
          attendeeName,
        },
      },
    })
  );
  return {
    bookings: body.data.map(toBookingSummary),
    nextPage: body.pagination.hasNextPage ? page + 1 : null,
  };
}
