import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import {
  apiBooking,
  bookingResponse,
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

// Relative to now, because only bookings that haven't ended can be cancelled.
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

const upcoming: TestBooking = {
  uid: "b1",
  title: "Itinerary review",
  start: hoursFromNow(24),
  end: hoursFromNow(25),
  attendees: [{ name: "Jane", email: "jane@example.com" }],
};

type Sent = { method: string; path: string; body: unknown };

/** Serves `shown`, answering a cancellation with the queued response or else the cancelled booking. */
async function renderBooking(shown: TestBooking, actionResponses: Response[] = []) {
  const sent: Sent[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const text = await request.text();
    sent.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: text ? JSON.parse(text) : null,
    });
    if (request.method !== "POST") return bookingResponse(shown);
    return (
      actionResponses.shift() ??
      jsonResponse({
        status: "success",
        data: apiBooking({ ...shown, status: "cancelled", cancellationReason: "Flight cancelled" }),
      })
    );
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: `/booking/${shown.uid}` });
  await screen.findByRole("header", { name: shown.title });
  return sent;
}

const actions = (sent: Sent[]) => sent.filter((request) => request.method === "POST");

describe("cancelling", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("cancels with a reason and returns to the booking", async () => {
    const sent = await renderBooking(upcoming);

    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.cancel }));
    expect(await screen.findByRole("header", { name: en.bookingActions.cancelTitle })).toBeOnTheScreen();
    expect(screen.getByText("Cal.diy will email Jane that the booking was cancelled.")).toBeOnTheScreen();
    await fireEvent.changeText(
      screen.getByLabelText(en.bookingActions.cancelReasonLabel),
      "Flight cancelled"
    );
    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.cancelSubmit }));

    expect(await screen.findByText("Reason for cancellation: Flight cancelled")).toBeOnTheScreen();
    expect(screen.getByText(en.bookings.status.cancelled)).toBeOnTheScreen();
    expect(screen).toHavePathname("/booking/b1");
    expect(actions(sent)).toEqual([
      {
        method: "POST",
        path: "/api/v2/bookings/b1/cancel",
        body: { cancellationReason: "Flight cancelled" },
      },
    ]);
  });

  it("asks for a reason before sending anything", async () => {
    const sent = await renderBooking(upcoming);

    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.cancel }));
    await fireEvent.press(await screen.findByRole("button", { name: en.bookingActions.cancelSubmit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(en.bookingActions.cancelReasonMissing);
    expect(actions(sent)).toEqual([]);
  });

  it("can cancel the later occurrences of a recurring booking too", async () => {
    const sent = await renderBooking({ ...upcoming, recurringBookingUid: "series-1" });

    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.cancel }));
    await fireEvent.changeText(
      await screen.findByLabelText(en.bookingActions.cancelReasonLabel),
      "Trip postponed"
    );
    await fireEvent(screen.getByLabelText(en.bookingActions.cancelLaterOccurrences), "valueChange", true);
    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.cancelSubmit }));

    await screen.findByText(en.bookings.status.cancelled);
    expect(actions(sent)[0]?.body).toEqual({
      cancellationReason: "Trip postponed",
      cancelSubsequentBookings: true,
    });
  });

  it("explains why the server refused", async () => {
    await renderBooking(upcoming, [
      jsonResponse(
        { statusCode: 400, message: "This event type does not allow cancellations" },
        { status: 400 }
      ),
    ]);

    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.cancel }));
    await fireEvent.changeText(await screen.findByLabelText(en.bookingActions.cancelReasonLabel), "Ill");
    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.cancelSubmit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your Cal.diy server said: “This event type does not allow cancellations”"
    );
    expect(screen.getByRole("button", { name: en.bookingActions.cancelSubmit })).toBeOnTheScreen();
  });

  it.each([
    ["has ended", { ...upcoming, start: hoursFromNow(-2), end: hoursFromNow(-1) }],
    ["is waiting for confirmation", { ...upcoming, status: "pending" as const }],
    ["is already cancelled", { ...upcoming, status: "cancelled" as const }],
  ])("doesn't offer to cancel a booking that %s", async (_state, booking) => {
    await renderBooking(booking);

    expect(screen.queryByRole("button", { name: en.bookingActions.cancel })).toBeNull();
  });
});
