import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { BOOKINGS_PAGE_SIZE } from "@/bookings/bookings-api";
import { formatDayHeading } from "@/bookings/format";
import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import { bookingsResponse, jsonResponse, type TestBooking, testAccount } from "@/test-utils/fixtures";

const mockStore = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));

function daysFromNow(days: number, hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

const upcoming: TestBooking[] = [
  {
    uid: "u1",
    title: "Strategy call",
    start: daysFromNow(1, 10),
    attendees: [{ name: "Jane", email: "jane@example.com" }],
  },
  {
    uid: "u2",
    title: "Itinerary review",
    start: daysFromNow(10, 9),
    attendees: [{ name: "Sam", email: "sam@example.com" }],
  },
];
const past: TestBooking[] = [{ uid: "p1", title: "Welcome call", start: daysFromNow(-3, 15) }];

type FakeServer = {
  bookings: Partial<Record<string, TestBooking[]>>;
  /** Overrides the next responses, one per request, before the fake data is used. */
  nextResponses: Response[];
  requests: URLSearchParams[];
};

function serve(server: FakeServer, input: RequestInfo | URL): Response {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.pathname !== "/api/v2/bookings") return new Response("Not found", { status: 404 });
  server.requests.push(url.searchParams);
  const override = server.nextResponses.shift();
  if (override) return override;

  const name = url.searchParams.get("attendeeName");
  const skip = Number(url.searchParams.get("skip"));
  const matching = (server.bookings[url.searchParams.get("status") ?? ""] ?? []).filter(
    (booking) => !name || booking.attendees?.some((attendee) => attendee.name.includes(name))
  );
  return bookingsResponse(matching.slice(skip, skip + BOOKINGS_PAGE_SIZE), {
    hasNextPage: skip + BOOKINGS_PAGE_SIZE < matching.length,
  });
}

async function renderBookings(bookings: FakeServer["bookings"] = { upcoming, past }) {
  const server: FakeServer = { bookings, nextResponses: [], requests: [] };
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => serve(server, input));
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes);
  return server;
}

describe("BookingsScreen", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("shows upcoming bookings under day headings", async () => {
    const server = await renderBookings();

    expect(await screen.findByText("Strategy call")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: en.bookings.days.tomorrow })).toBeOnTheScreen();
    const laterHeading = formatDayHeading(upcoming[1]?.start ?? "", {
      locale: "en-US",
      now: new Date(),
      labels: en.bookings.days,
    });
    expect(screen.getByRole("header", { name: laterHeading })).toBeOnTheScreen();
    expect(screen.getByText("with Jane")).toBeOnTheScreen();
    expect(server.requests[0]?.get("status")).toBe("upcoming");
  });

  it("switches to another filter", async () => {
    const server = await renderBookings();
    await screen.findByText("Strategy call");

    await fireEvent.press(screen.getByRole("tab", { name: en.bookings.filters.past }));

    expect(await screen.findByText("Welcome call")).toBeOnTheScreen();
    expect(screen.queryByText("Strategy call")).toBeNull();
    expect(server.requests.at(-1)?.get("status")).toBe("past");
  });

  it("searches attendees on the server once typing pauses, keeping results on screen meanwhile", async () => {
    const server = await renderBookings();
    await screen.findByText("Strategy call");

    await fireEvent.changeText(screen.getByLabelText(en.bookings.searchLabel), "Sam");

    // Sam's booking stays listed the whole time (no spinner between searches); Jane's goes once the search
    // result arrives.
    await waitFor(() => expect(screen.queryByText("Strategy call")).toBeNull());
    expect(screen.getByText("Itinerary review")).toBeOnTheScreen();
    expect(server.requests.at(-1)?.get("attendeeName")).toBe("Sam");
  });

  it("says when a filter has no bookings", async () => {
    await renderBookings({ upcoming: [] });

    expect(await screen.findByText(en.bookings.empty.upcoming)).toBeOnTheScreen();
  });

  it("loads the next page when the end of the list is reached", async () => {
    const many = Array.from({ length: 25 }, (_, index) => ({
      uid: `m${index}`,
      title: `Session ${index}`,
      start: daysFromNow(2, 8),
    }));
    const server = await renderBookings({ upcoming: many });
    await screen.findByText("Session 0");

    await fireEvent(screen.getByTestId("bookings-list"), "endReached");

    await waitFor(() => expect(server.requests).toHaveLength(2));
    expect(server.requests.map((params) => params.get("skip"))).toEqual(["0", String(BOOKINGS_PAGE_SIZE)]);
  });

  it("fetches again on pull to refresh", async () => {
    const server = await renderBookings();
    await screen.findByText("Strategy call");

    await fireEvent(screen.getByTestId("bookings-list"), "refresh");

    expect(server.requests).toHaveLength(2);
  });

  it("keeps the bookings on screen when a refresh fails", async () => {
    const server = await renderBookings();
    await screen.findByText("Strategy call");
    server.nextResponses.push(
      jsonResponse({ status: "error", error: { message: "Too Many Requests" } }, { status: 429 })
    );

    await fireEvent(screen.getByTestId("bookings-list"), "refresh");

    expect(await screen.findByRole("alert")).toHaveTextContent(en.bookings.refreshFailed);
    expect(screen.getByText("Strategy call")).toBeOnTheScreen();
  });

  it("asks for a new sign-in when the API key stops working", async () => {
    const server = await renderBookings();
    server.nextResponses.push(
      jsonResponse({ status: "error", error: { message: "Invalid API Key" } }, { status: 401 })
    );
    await fireEvent.press(await screen.findByRole("tab", { name: en.bookings.filters.cancelled }));

    expect(await screen.findByRole("alert")).toHaveTextContent(en.loadErrors.unauthorized);
    await fireEvent.press(screen.getByRole("button", { name: en.loadErrors.signInAgain }));

    expect(await screen.findByRole("header", { name: en.signIn.server.title })).toBeOnTheScreen();
  });

  it("offers to try again after a failed load", async () => {
    const server = await renderBookings();
    server.nextResponses.push(
      jsonResponse(
        { status: "error", error: { message: "Too Many Requests" } },
        { status: 429, headers: { "X-RateLimit-Reset-Default": "30" } }
      )
    );
    await fireEvent.press(await screen.findByRole("tab", { name: en.bookings.filters.past }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests. Try again in 30 seconds.");
    await fireEvent.press(screen.getByRole("button", { name: en.loadErrors.retry }));

    expect(await screen.findByText("Welcome call")).toBeOnTheScreen();
  });
});
