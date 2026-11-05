import type { Account } from "@/session/account";

// Kept apart from app-routes.ts so unit tests don't load every screen just to get test data.

export const testAccount: Account = {
  serverOrigin: "https://book.example.com",
  apiRootUrl: "https://book.example.com/api",
  user: { id: 7, username: "alan", name: "Alan", email: "alan@example.com", timeZone: "Asia/Kuala_Lumpur" },
};

/** A GET /v2/me body for testAccount. */
export const testMeResponse = {
  status: "success",
  data: {
    id: 7,
    username: "alan",
    email: "alan@example.com",
    name: "Alan",
    avatarUrl: null,
    bio: null,
    timeFormat: 12,
    defaultScheduleId: 1,
    weekStart: "Monday",
    timeZone: "Asia/Kuala_Lumpur",
    organizationId: null,
  },
};

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export type TestBooking = {
  uid: string;
  title: string;
  start: string;
  end?: string;
  status?: "accepted" | "pending" | "cancelled" | "rejected";
  location?: string;
  description?: string;
  /** Booking question answers, keyed by field name. */
  responses?: Record<string, unknown>;
  cancellationReason?: string;
  reschedulingReason?: string;
  recurringBookingUid?: string;
  attendees?: { name: string; email: string; timeZone?: string; phoneNumber?: string; absent?: boolean }[];
};

/** One booking as API v2 (cal-api-version 2024-08-13) sends it. */
export function apiBooking(booking: TestBooking, id = 1) {
  const end = booking.end ?? booking.start;
  return {
    id,
    uid: booking.uid,
    title: booking.title,
    description: booking.description ?? "",
    hosts: [],
    status: booking.status ?? "accepted",
    start: booking.start,
    end,
    duration: (Date.parse(end) - Date.parse(booking.start)) / 60_000,
    eventTypeId: 3,
    eventType: { id: 3, slug: "30min" },
    location: booking.location ?? "",
    ...(booking.recurringBookingUid ? { recurringBookingUid: booking.recurringBookingUid } : {}),
    absentHost: false,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    attendees: (booking.attendees ?? []).map(
      ({ absent = false, timeZone = "Asia/Kuala_Lumpur", ...attendee }) => ({
        ...attendee,
        displayEmail: attendee.email,
        timeZone,
        absent,
      })
    ),
    ...(booking.cancellationReason ? { cancellationReason: booking.cancellationReason } : {}),
    ...(booking.reschedulingReason ? { reschedulingReason: booking.reschedulingReason } : {}),
    bookingFieldsResponses: booking.responses ?? {},
  };
}

/** A GET /v2/bookings body holding the given bookings. */
export function bookingsResponse(bookings: TestBooking[], { hasNextPage = false } = {}): Response {
  return jsonResponse({
    status: "success",
    data: bookings.map((booking, index) => apiBooking(booking, index + 1)),
    pagination: {
      totalItems: bookings.length,
      remainingItems: hasNextPage ? 1 : 0,
      returnedItems: bookings.length,
      itemsPerPage: 20,
      currentPage: 1,
      totalPages: hasNextPage ? 2 : 1,
      hasNextPage,
      hasPreviousPage: false,
    },
  });
}

/** A GET /v2/bookings/{uid} body for one booking. */
export function bookingResponse(booking: TestBooking): Response {
  return jsonResponse({ status: "success", data: apiBooking(booking) });
}
