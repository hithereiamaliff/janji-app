import { createCalClient } from "@janji/cal-api/client";
import { CalApiError } from "@janji/cal-api/errors";

import { BOOKINGS_PAGE_SIZE, fetchBookingsPage } from "@/bookings/bookings-api";
import { jsonResponse } from "@/test-utils/fixtures";

function bookingsBody({ uids, hasNextPage }: { uids: string[]; hasNextPage: boolean }) {
  return {
    status: "success",
    data: uids.map((uid) => ({
      id: 1,
      uid,
      title: `Booking ${uid}`,
      description: "",
      hosts: [],
      status: "accepted",
      start: "2026-11-06T07:00:00.000Z",
      end: "2026-11-06T07:30:00.000Z",
      duration: 30,
      eventTypeId: 3,
      eventType: { id: 3, slug: "30min" },
      location: "",
      absentHost: false,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
      attendees: [],
      bookingFieldsResponses: {},
    })),
    pagination: {
      totalItems: uids.length,
      remainingItems: 0,
      returnedItems: uids.length,
      itemsPerPage: BOOKINGS_PAGE_SIZE,
      currentPage: 1,
      totalPages: 1,
      hasNextPage,
      hasPreviousPage: false,
    },
  };
}

function clientRespondingWith(response: () => Response) {
  const urls: URL[] = [];
  const client = createCalClient({
    apiRootUrl: "https://book.example.com/api",
    getApiKey: () => "cal_secret",
    fetch: async (request) => {
      urls.push(new URL(request.url));
      return response();
    },
  });
  return { client, urls };
}

describe("fetchBookingsPage", () => {
  it.each([
    ["upcoming", "asc"],
    ["unconfirmed", "asc"],
    ["past", "desc"],
    ["cancelled", "desc"],
  ] as const)("asks for %s bookings, sorted %s by start", async (filter, order) => {
    const { client, urls } = clientRespondingWith(() =>
      jsonResponse(bookingsBody({ uids: [], hasNextPage: false }))
    );

    await fetchBookingsPage(client, { filter, page: 0 });

    const params = urls[0]?.searchParams;
    expect(params?.get("status")).toBe(filter);
    expect(params?.get("sortStart")).toBe(order);
    expect(params?.get("take")).toBe(String(BOOKINGS_PAGE_SIZE));
    expect(params?.get("skip")).toBe("0");
    expect(params?.has("attendeeName")).toBe(false);
  });

  it("skips earlier pages and searches attendee names", async () => {
    const { client, urls } = clientRespondingWith(() =>
      jsonResponse(bookingsBody({ uids: [], hasNextPage: false }))
    );

    await fetchBookingsPage(client, { filter: "upcoming", page: 2, search: "  Jane " });

    expect(urls[0]?.searchParams.get("skip")).toBe(String(2 * BOOKINGS_PAGE_SIZE));
    expect(urls[0]?.searchParams.get("attendeeName")).toBe("Jane");
  });

  it("returns the bookings and whether another page follows", async () => {
    const { client } = clientRespondingWith(() =>
      jsonResponse(bookingsBody({ uids: ["a", "b"], hasNextPage: true }))
    );

    const page = await fetchBookingsPage(client, { filter: "upcoming", page: 0 });

    expect(page.bookings.map((booking) => booking.uid)).toEqual(["a", "b"]);
    expect(page.nextPage).toBe(1);
  });

  it("reports the last page with no next page", async () => {
    const { client } = clientRespondingWith(() =>
      jsonResponse(bookingsBody({ uids: ["a"], hasNextPage: false }))
    );

    await expect(fetchBookingsPage(client, { filter: "past", page: 3 })).resolves.toMatchObject({
      nextPage: null,
    });
  });

  it("passes API errors on as CalApiError", async () => {
    const { client } = clientRespondingWith(() =>
      jsonResponse({ status: "error", error: { message: "Invalid API Key" } }, { status: 401 })
    );

    await expect(fetchBookingsPage(client, { filter: "upcoming", page: 0 })).rejects.toBeInstanceOf(
      CalApiError
    );
  });
});
