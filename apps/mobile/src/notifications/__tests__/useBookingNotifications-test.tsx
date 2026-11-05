import { act, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { noteChangedHere } from "@/bookings/recent-changes";
import { bookingUidOf, presentationOf } from "@/notifications/useBookingNotifications";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import {
  bookingResponse,
  bookingsResponse,
  jsonResponse,
  type TestBooking,
  testAccount,
  testMeResponse,
} from "@/test-utils/fixtures";

type Listener<T> = (event: T) => void;
type MockResponse = { actionIdentifier: string; notification: MockNotification };
type MockNotification = { request: { content: { data?: Record<string, unknown> } } };

const mockStore = new Map<string, string>();
const mockTaps = new Set<Listener<MockResponse>>();
const mockArrivals = new Set<Listener<MockNotification>>();
let mockLastTap: MockResponse | null;
const mockClearLastTap = jest.fn();

jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));

jest.mock("expo-notifications", () => ({
  DEFAULT_ACTION_IDENTIFIER: "expo.modules.notifications.actions.DEFAULT",
  getLastNotificationResponse: () => mockLastTap,
  clearLastNotificationResponse: () => mockClearLastTap(),
  addNotificationResponseReceivedListener: (listener: Listener<MockResponse>) => {
    mockTaps.add(listener);
    return { remove: () => mockTaps.delete(listener) };
  },
  addNotificationReceivedListener: (listener: Listener<MockNotification>) => {
    mockArrivals.add(listener);
    return { remove: () => mockArrivals.delete(listener) };
  },
  addPushTokenListener: () => ({ remove: () => undefined }),
  setNotificationHandler: () => undefined,
}));

jest.mock("@/notifications/push-setup", () => {
  const setup = { platform: "ios", relayOrigin: "https://relay.example", projectId: "project-1" };
  return { pushBuild: () => setup, loadPushSetup: async () => setup };
});

const booking: TestBooking = {
  uid: "booking-1",
  title: "Consultation: Test Payment",
  start: "2026-11-06T02:00:00.000Z",
  end: "2026-11-06T02:30:00.000Z",
};
const about = (data: Record<string, unknown>): MockNotification => ({ request: { content: { data } } });
const tap = (
  data: Record<string, unknown>,
  actionIdentifier = "expo.modules.notifications.actions.DEFAULT"
) => ({
  actionIdentifier,
  notification: about(data),
});

/** Opens the bookings list, counting how often it's loaded. */
async function openApp() {
  const loads = { list: 0 };
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const { pathname } = new URL(request.url);
    if (pathname.endsWith("/v2/me")) return jsonResponse(testMeResponse);
    if (pathname.endsWith(`/v2/bookings/${booking.uid}`)) return bookingResponse(booking);
    if (pathname.endsWith("/v2/bookings")) {
      loads.list += 1;
      return bookingsResponse([booking]);
    }
    return jsonResponse({ status: "success", data: [] });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: "/" });
  return loads;
}

describe("booking notifications", () => {
  beforeEach(() => {
    mockStore.clear();
    mockLastTap = null;
    mockClearLastTap.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it("opens the booking a tapped notification is about", async () => {
    await openApp();
    await screen.findByText(booking.title);

    await act(async () => {
      for (const listener of mockTaps) listener(tap({ bookingUid: booking.uid }));
    });

    await waitFor(() => expect(screen).toHavePathname(`/booking/${booking.uid}`));
    expect(mockClearLastTap).toHaveBeenCalled();
  });

  it("opens it when tapping the notification started the app", async () => {
    mockLastTap = tap({ bookingUid: booking.uid });
    await openApp();

    await waitFor(() => expect(screen).toHavePathname(`/booking/${booking.uid}`));
  });

  it.each([
    ["has no booking", tap({})],
    ["was answered with another action", tap({ bookingUid: booking.uid }, "dismiss")],
  ])("stays put for a notification that %s", async (_, response) => {
    await openApp();
    await screen.findByText(booking.title);

    await act(async () => {
      for (const listener of mockTaps) listener(response);
    });

    expect(screen).toHavePathname("/");
  });

  it("loads the bookings again when one arrives while the app is open", async () => {
    const loads = await openApp();
    await screen.findByText(booking.title);
    const before = loads.list;

    await act(async () => {
      for (const listener of mockArrivals) listener(about({ bookingUid: booking.uid }));
    });

    await waitFor(() => expect(loads.list).toBeGreaterThan(before));
  });
});

describe("bookingUidOf", () => {
  it("reads only a booking UID the relay put there", () => {
    expect(bookingUidOf(about({ bookingUid: "abc" }))).toBe("abc");
    expect(bookingUidOf(about({ bookingUid: 4 }))).toBeNull();
    expect(bookingUidOf(about({ bookingUid: "" }))).toBeNull();
    expect(bookingUidOf({ request: { content: {} } })).toBeNull();
  });
});

describe("presentationOf", () => {
  const shown = {
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  };
  const quiet = {
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  };

  it("shows a notification about someone else's change", () => {
    expect(presentationOf(about({ bookingUid: "booked-elsewhere" }))).toEqual(shown);
  });

  it("keeps quiet about a booking just changed in Janji, and a reschedule of one", () => {
    noteChangedHere("cancelled-here");
    noteChangedHere("moved-here");

    expect(presentationOf(about({ bookingUid: "cancelled-here" }))).toEqual(quiet);
    expect(presentationOf(about({ bookingUid: "new-booking", rescheduledFrom: "moved-here" }))).toEqual(
      quiet
    );
  });
});
