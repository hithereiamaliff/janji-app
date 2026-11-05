import { act } from "@testing-library/react-native";
import { router } from "expo-router";
import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import { formatDayHeading } from "@/bookings/format";
import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import {
  apiBooking,
  bookingResponse,
  bookingsResponse,
  jsonResponse,
  type TestBooking,
  testAccount,
} from "@/test-utils/fixtures";

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

/** An hour on a day relative to today, on the test device's clock (UTC). */
function at(daysFromToday: number, hour: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour);
  return date.toISOString();
}

const booking: TestBooking = {
  uid: "b1",
  title: "Itinerary review",
  start: at(1, 10),
  end: at(1, 11),
  attendees: [{ name: "Jane", email: "jane@example.com" }],
};

type Sent = { method: string; url: URL; body: unknown };

type FakeServer = {
  /** Free times per request to /v2/slots, in order; the last one repeats. */
  slots: string[][];
  rescheduleResponse?: Response;
};

async function renderBooking(server: FakeServer, initialUrl = "/booking/b1") {
  const sent: Sent[] = [];
  let slotRequests = 0;
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const url = new URL(request.url);
    const text = await request.text();
    sent.push({ method: request.method, url, body: text ? JSON.parse(text) : null });
    if (url.pathname === "/api/v2/slots") {
      const starts = server.slots[Math.min(slotRequests++, server.slots.length - 1)] ?? [];
      const data: Record<string, { start: string }[]> = {};
      for (const start of starts) {
        const date = start.slice(0, 10);
        data[date] = [...(data[date] ?? []), { start }];
      }
      return jsonResponse({ status: "success", data });
    }
    if (url.pathname.endsWith("/reschedule")) {
      return (
        server.rescheduleResponse ??
        jsonResponse({
          status: "success",
          data: apiBooking({ ...booking, uid: "b2", start: at(2, 14), end: at(2, 15) }),
        })
      );
    }
    if (url.pathname === "/api/v2/bookings") return bookingsResponse([booking]);
    if (url.pathname === "/api/v2/bookings/b2") {
      return bookingResponse({
        ...booking,
        uid: "b2",
        start: at(2, 14),
        end: at(2, 15),
        reschedulingReason: "Flight moved",
      });
    }
    return bookingResponse(booking);
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl });
  if (initialUrl === "/") {
    await fireEvent.press(await screen.findByRole("button", { name: /Itinerary review/ }));
  }
  await screen.findByRole("header", { name: booking.title });
  await fireEvent.press(screen.getByRole("button", { name: en.reschedule.action }));
  await screen.findByRole("header", { name: en.reschedule.title });
  return sent;
}

const slotRequests = (sent: Sent[]) => sent.filter((request) => request.url.pathname === "/api/v2/slots");

describe("rescheduling", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("shows free times by day and moves the booking to the one picked", async () => {
    const sent = await renderBooking({ slots: [[at(1, 9), booking.start, at(2, 14)]] });

    expect(await screen.findByRole("tab", { name: en.bookings.days.tomorrow })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /9:00 AM/ })).toBeOnTheScreen();
    // The booking's own time comes back as free, but isn't offered.
    expect(screen.queryByRole("button", { name: /10:00 AM – 11:00 AM/ })).toBeNull();

    const dayAfter = formatDayHeading(at(2, 14), {
      locale: "en-US",
      now: new Date(),
      labels: en.bookings.days,
    });
    await fireEvent.press(screen.getByRole("tab", { name: dayAfter }));
    await fireEvent.press(await screen.findByRole("button", { name: /2:00 PM – 3:00 PM/ }));
    expect(screen.getByText(/^New time: /)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(en.reschedule.reasonLabel), "Flight moved");
    await fireEvent.press(screen.getByRole("button", { name: en.reschedule.submit }));

    expect(await screen.findByText(en.reschedule.done)).toBeOnTheScreen();
    expect(screen).toHavePathname("/booking/b2");
    expect(sent.find((request) => request.method === "POST")?.body).toEqual({
      start: at(2, 14),
      rescheduledBy: testAccount.user.email,
      reschedulingReason: "Flight moved",
    });
    expect(slotRequests(sent)[0]?.url.searchParams.get("bookingUidToReschedule")).toBe("b1");
  });

  it("puts the new booking in the original's place, so going back leads to the list", async () => {
    await renderBooking({ slots: [[at(2, 14)]] }, "/");

    await fireEvent.press(await screen.findByRole("button", { name: /2:00 PM/ }));
    await fireEvent.press(screen.getByRole("button", { name: en.reschedule.submit }));
    await screen.findByText(en.reschedule.done);
    expect(screen).toHavePathname("/booking/b2");

    await act(() => router.back());

    expect(screen).toHavePathname("/");
  });

  it("looks further ahead when the next two weeks are full", async () => {
    const sent = await renderBooking({ slots: [[], [at(20, 9)]] });

    expect(await screen.findByText(/^No free times between/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: en.reschedule.later }));

    expect(await screen.findByRole("button", { name: /9:00 AM/ })).toBeOnTheScreen();
    expect(slotRequests(sent).map((request) => request.url.searchParams.get("start"))).toEqual([
      expect.any(String),
      at(14, 0),
    ]);
  });

  it("explains why the server refused the new time", async () => {
    await renderBooking({
      slots: [[at(2, 14)]],
      rescheduleResponse: jsonResponse(
        {
          status: "error",
          error: { message: "User either already has booking at this time or is not available" },
        },
        { status: 400 }
      ),
    });

    await fireEvent.press(await screen.findByRole("button", { name: /2:00 PM/ }));
    await fireEvent.press(screen.getByRole("button", { name: en.reschedule.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your Cal.diy server said: “User either already has booking at this time or is not available”"
    );
  });

  it("can't be sent before a time is picked", async () => {
    await renderBooking({ slots: [[at(2, 14)]] });

    expect(await screen.findByRole("button", { name: en.reschedule.submit })).toBeDisabled();
  });
});
