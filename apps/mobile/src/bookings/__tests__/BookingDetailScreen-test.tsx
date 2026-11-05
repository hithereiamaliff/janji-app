import { act } from "@testing-library/react-native";
import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import { isValidElement } from "react";
import { Linking, type RefreshControlProps } from "react-native";

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

// The test device runs in UTC (jest.global-setup.js) and the account's profile uses Asia/Kuala_Lumpur.
const booking: TestBooking = {
  uid: "b1",
  title: "Itinerary review",
  start: "2026-11-06T08:00:00Z",
  end: "2026-11-06T09:00:00Z",
  location: "https://meet.google.com/abc-defg-hij",
  recurringBookingUid: "series-1",
  attendees: [
    { name: "Jane", email: "jane@example.com", timeZone: "America/New_York", phoneNumber: "+1 212-555-0100" },
    { name: "Sam", email: "sam@example.com", timeZone: "Europe/London", absent: true },
  ],
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
  beforeEach(() => {
    mockStore.clear();
    // Linking.openURL is already a mock in React Native's Jest setup, so its calls outlive restoreAllMocks.
    jest.clearAllMocks();
  });
  afterEach(() => jest.restoreAllMocks());

  it("shows when the booking is, with the time in the profile's time zone too", async () => {
    const { requests } = await renderDetail();

    expect(await screen.findByRole("header", { name: "Itinerary review" })).toBeOnTheScreen();
    expect(requests).toContain("/api/v2/bookings/b1");
    expect(screen.getByText(/^Friday\W+November 6\W+2026$/)).toBeOnTheScreen();
    expect(screen.getByText("8:00 AM – 9:00 AM")).toBeOnTheScreen();
    expect(screen.getByText("60 minutes")).toBeOnTheScreen();
    expect(
      screen.getByText("Fri 4:00 PM – 5:00 PM in Kuala Lumpur, your Cal.diy time zone")
    ).toBeOnTheScreen();
    expect(screen.getByText(en.bookingDetail.recurring)).toBeOnTheScreen();
  });

  it("labels bookings that aren't confirmed", async () => {
    await renderDetail([], { ...booking, status: "pending" });

    expect(await screen.findByText(en.bookings.status.pending)).toBeOnTheScreen();
  });

  it("opens the meeting link", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await renderDetail();

    await fireEvent.press(await screen.findByRole("link", { name: en.bookingDetail.joinMeeting }));

    expect(openURL).toHaveBeenCalledWith("https://meet.google.com/abc-defg-hij");
    expect(screen.getByText("meet.google.com")).toBeOnTheScreen();
  });

  it("shows a written location as text", async () => {
    await renderDetail([], { ...booking, location: "Level 3, 12 Jalan Ampang" });

    expect(await screen.findByText("Level 3, 12 Jalan Ampang")).toBeOnTheScreen();
    expect(screen.queryByRole("link", { name: en.bookingDetail.joinMeeting })).toBeNull();
  });

  it("calls a phone location", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await renderDetail([], { ...booking, location: "+60 12-345 6789" });

    await fireEvent.press(await screen.findByRole("link", { name: "Call +60 12-345 6789" }));

    expect(openURL).toHaveBeenCalledWith("tel:+60123456789");
  });

  it("names an online meeting that has no link yet", async () => {
    await renderDetail([], { ...booking, location: "integrations:daily" });

    expect(await screen.findByText(en.bookingDetail.onlineMeeting)).toBeOnTheScreen();
  });

  it("lists attendees with ways to reach them and the time where they are", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await renderDetail();

    await fireEvent.press(await screen.findByRole("link", { name: "Email jane@example.com" }));
    await fireEvent.press(screen.getByRole("link", { name: "Call +1 212-555-0100" }));

    expect(openURL.mock.calls).toEqual([["mailto:jane@example.com"], ["tel:+12125550100"]]);
    expect(screen.getByText("Fri 3:00 AM – 4:00 AM their time (New York)")).toBeOnTheScreen();
    // Sam's clock in London reads the same as the device's, so there's nothing to add for them.
    expect(screen.getAllByText(/their time/)).toHaveLength(1);
    expect(screen.getByText(en.bookingDetail.noShow)).toBeOnTheScreen();
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
