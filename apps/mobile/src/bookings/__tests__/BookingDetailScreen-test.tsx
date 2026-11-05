import { act } from "@testing-library/react-native";
import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import { isValidElement } from "react";
import type { RefreshControlProps } from "react-native";

import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import { bookingResponse, jsonResponse, type TestBooking, testAccount } from "@/test-utils/fixtures";

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

// The test device runs in UTC (jest.global-setup.js).
const booking: TestBooking = {
  uid: "b1",
  title: "Itinerary review",
  start: "2026-11-06T08:00:00Z",
  end: "2026-11-06T09:00:00Z",
  recurringBookingUid: "series-1",
};

function apiError(status: number, message: string): Response {
  return jsonResponse({ status: "error", error: { message } }, { status });
}

/** React Native's RefreshControl test mock drops its props, so this calls the handler the screen gave it. */
async function pullToRefresh(testID: string) {
  const control: unknown = screen.getByTestId(testID).props.refreshControl;
  if (!isValidElement<RefreshControlProps>(control)) throw new Error(`${testID} has no refresh control`);
  await act(async () => {
    await control.props.onRefresh?.();
  });
}

/** Serves `shown` unless a queued response comes first. */
async function renderDetail(queued: Response[] = [], shown: TestBooking = booking) {
  const requests: string[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    requests.push(new URL(input instanceof Request ? input.url : String(input)).pathname);
    return queued.shift() ?? bookingResponse(shown);
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: "/booking/b1" });
  return { requests, queued };
}

describe("BookingDetailScreen", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("shows the booking's title and when it is", async () => {
    const { requests } = await renderDetail();

    expect(await screen.findByRole("header", { name: "Itinerary review" })).toBeOnTheScreen();
    expect(requests).toContain("/api/v2/bookings/b1");
    expect(screen.getByText(/^Friday\W+November 6\W+2026$/)).toBeOnTheScreen();
    expect(screen.getByText("8:00 AM – 9:00 AM")).toBeOnTheScreen();
    expect(screen.getByText("60 minutes")).toBeOnTheScreen();
    expect(screen.getByText(en.bookingDetail.recurring)).toBeOnTheScreen();
  });

  it("labels bookings that aren't confirmed", async () => {
    await renderDetail([], { ...booking, status: "pending" });

    expect(await screen.findByText(en.bookings.status.pending)).toBeOnTheScreen();
  });

  it("says when the booking no longer exists, without offering to try again", async () => {
    await renderDetail([apiError(404, "Booking with uid=b1 was not found in the database")]);

    expect(await screen.findByRole("alert")).toHaveTextContent(en.bookingDetail.notFound);
    expect(screen.queryByRole("button", { name: en.loadErrors.retry })).toBeNull();
  });

  it("offers to try again after a failed load", async () => {
    await renderDetail([apiError(429, "Too Many Requests")]);

    expect(await screen.findByRole("alert")).toHaveTextContent(en.loadErrors.rate_limited_unknown);
    await fireEvent.press(screen.getByRole("button", { name: en.loadErrors.retry }));

    expect(await screen.findByRole("header", { name: "Itinerary review" })).toBeOnTheScreen();
  });

  it("keeps the booking on screen when a refresh fails", async () => {
    const { queued } = await renderDetail();
    await screen.findByRole("header", { name: "Itinerary review" });
    queued.push(apiError(429, "Too Many Requests"));

    await pullToRefresh("booking-detail");

    expect(await screen.findByRole("alert")).toHaveTextContent(en.bookingDetail.refreshFailed);
    expect(screen.getByRole("header", { name: "Itinerary review" })).toBeOnTheScreen();
  });
});
