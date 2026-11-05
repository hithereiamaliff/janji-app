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
  attendees?: { name: string; email: string }[];
};

/** A GET /v2/bookings body (cal-api-version 2024-08-13) holding the given bookings. */
export function bookingsResponse(bookings: TestBooking[], { hasNextPage = false } = {}): Response {
  return jsonResponse({
    status: "success",
    data: bookings.map((booking, index) => ({
      id: index + 1,
      uid: booking.uid,
      title: booking.title,
      description: "",
      hosts: [],
      status: booking.status ?? "accepted",
      start: booking.start,
      end: booking.end ?? booking.start,
      duration: 30,
      eventTypeId: 3,
      eventType: { id: 3, slug: "30min" },
      location: "",
      absentHost: false,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
      attendees: (booking.attendees ?? []).map((attendee) => ({
        ...attendee,
        displayEmail: attendee.email,
        timeZone: "Asia/Kuala_Lumpur",
        absent: false,
      })),
      bookingFieldsResponses: {},
    })),
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
