import type { ApiSchedule } from "@/availability/schedule";
import type { ApiEventType } from "@/event-types/event-type";
import type { ApiPrivateLink } from "@/event-types/private-links";
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
  attendees?: {
    name: string;
    email: string;
    /** API v2's copy of `email` without its alias; the same as `email` unless given. */
    displayEmail?: string;
    timeZone?: string;
    phoneNumber?: string;
    absent?: boolean;
  }[];
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
        displayEmail: attendee.displayEmail ?? attendee.email,
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

export type TestEventType = {
  id: number;
  title: string;
  slug: string;
  lengthInMinutes?: number;
  lengthInMinutesOptions?: number[];
  description?: string;
  /** In minutes. */
  minimumBookingNotice?: number;
  hidden?: boolean;
};

/** One event type as API v2 (cal-api-version 2024-06-14) sends it. */
export function apiEventType(eventType: TestEventType): ApiEventType {
  return {
    id: eventType.id,
    title: eventType.title,
    slug: eventType.slug,
    lengthInMinutes: eventType.lengthInMinutes ?? 30,
    ...(eventType.lengthInMinutesOptions ? { lengthInMinutesOptions: eventType.lengthInMinutesOptions } : {}),
    description: eventType.description ?? "",
    minimumBookingNotice: eventType.minimumBookingNotice ?? 0,
    locations: [],
    bookingFields: [],
    disableGuests: false,
    recurrence: null,
    metadata: {},
    price: 0,
    currency: "usd",
    lockTimeZoneToggleOnBookingPage: false,
    forwardParamsSuccessRedirect: null,
    successRedirectUrl: null,
    isInstantEvent: false,
    scheduleId: null,
    hidden: eventType.hidden ?? false,
    bookingRequiresAuthentication: false,
    ownerId: 7,
    users: ["alan"],
    bookingUrl: `https://cal.com/alan/${eventType.slug}`,
  };
}

/** A GET /v2/event-types body holding the given event types. */
export function eventTypesResponse(eventTypes: TestEventType[]): Response {
  return jsonResponse({ status: "success", data: eventTypes.map(apiEventType) });
}

/** A private link that ends on a date, or after a number of bookings (one, unless given). */
export type TestPrivateLink =
  | { id: string; expiresAt: string; expired?: boolean }
  | { id: string; used?: number; max?: number; expired?: boolean };

/** One private link as API v2 sends it, with the bookingUrl a server without WEBSITE_URL builds. */
export function apiPrivateLink(link: TestPrivateLink, eventTypeId = 2): ApiPrivateLink {
  const base = {
    linkId: link.id,
    eventTypeId,
    isExpired: link.expired ?? false,
    bookingUrl: `https://cal.com/d/${link.id}`,
  };
  return "expiresAt" in link
    ? { ...base, expiresAt: link.expiresAt }
    : { ...base, maxUsageCount: link.max ?? 1, usageCount: link.used ?? 0 };
}

/** A GET /v2/event-types/{id}/private-links body holding the given links. */
export function privateLinksResponse(links: TestPrivateLink[], eventTypeId = 2): Response {
  return jsonResponse({ status: "success", data: links.map((link) => apiPrivateLink(link, eventTypeId)) });
}

export type TestSchedule = Partial<ApiSchedule> & { id: number; name: string };

/** One schedule as API v2 (cal-api-version 2024-06-11) sends it: Monday to Friday, 9 to 5, unless given. */
export function apiSchedule(schedule: TestSchedule): ApiSchedule {
  return {
    ownerId: 7,
    timeZone: "Asia/Kuala_Lumpur",
    availability: [
      {
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        startTime: "09:00",
        endTime: "17:00",
      },
    ],
    isDefault: false,
    overrides: [],
    ...schedule,
  };
}

/** A GET /v2/schedules body holding the given schedules. */
export function schedulesResponse(schedules: TestSchedule[]): Response {
  return jsonResponse({ status: "success", data: schedules.map(apiSchedule) });
}
