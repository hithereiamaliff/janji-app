import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import * as WebBrowser from "expo-web-browser";
import { Share } from "react-native";

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
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "opened" })) }));

const booking: TestBooking = {
  uid: "b1",
  title: "Itinerary review",
  start: "2026-11-06T08:00:00Z",
  end: "2026-11-06T09:00:00Z",
  attendees: [{ name: "Jane", email: "jane@example.com" }],
};
const google = "https://calendar.google.com/calendar/r/eventedit?text=Itinerary+review";

/** Opens the booking on 5 November 2026, counting the calendar link requests. */
async function openBooking(shown: TestBooking = booking) {
  const loads = { calendarLinks: 0 };
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const { pathname } = new URL(input instanceof Request ? input.url : String(input));
    if (pathname.endsWith("/calendar-links")) {
      loads.calendarLinks += 1;
      return jsonResponse({
        status: "success",
        data: [
          { label: "Google Calendar", link: google },
          { label: "Microsoft Outlook", link: "https://outlook.live.com/calendar/0/deeplink/compose" },
          { label: "Microsoft Office", link: "https://outlook.office.com/calendar/0/deeplink/compose" },
          { label: "ICS", link: "data:text/calendar,BEGIN%3AVCALENDAR" },
        ],
      });
    }
    return bookingResponse(shown);
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-05T09:00:00Z"));
  await renderRouter(appRoutes, { initialUrl: "/booking/b1" });
  await screen.findByRole("header", { name: shown.title });
  return loads;
}

describe("sharing a booking and adding it to a calendar", () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });
  afterEach(() => jest.restoreAllMocks());

  it("shares the booking's page on the server", async () => {
    const share = jest
      .spyOn(Share, "share")
      .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    await openBooking();

    await fireEvent.press(screen.getByRole("button", { name: en.bookingDetail.share }));

    expect(share).toHaveBeenCalledWith({ url: "https://book.example.com/booking/b1" });
  });

  it("offers the web calendars only once asked, and opens the one chosen", async () => {
    const loads = await openBooking();
    expect(loads.calendarLinks).toBe(0);

    await fireEvent.press(screen.getByRole("button", { name: en.bookingDetail.addToCalendar }));

    expect(await screen.findByRole("button", { name: "Outlook.com" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Microsoft 365" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "ICS" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Google Calendar" }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(google);
  });

  it("only shares a booking that has ended", async () => {
    await openBooking({ ...booking, start: "2026-11-04T08:00:00Z", end: "2026-11-04T09:00:00Z" });

    expect(screen.getByRole("button", { name: en.bookingDetail.share })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: en.bookingDetail.addToCalendar })).toBeNull();
  });

  it("offers neither for a cancelled booking", async () => {
    await openBooking({ ...booking, status: "cancelled" });

    expect(screen.queryByRole("button", { name: en.bookingDetail.share })).toBeNull();
    expect(screen.queryByRole("button", { name: en.bookingDetail.addToCalendar })).toBeNull();
  });
});
