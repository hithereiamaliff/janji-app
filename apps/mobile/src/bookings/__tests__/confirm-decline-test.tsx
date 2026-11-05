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

const pending: TestBooking = {
  uid: "b1",
  title: "Itinerary review",
  start: "2026-11-06T08:00:00Z",
  end: "2026-11-06T09:00:00Z",
  status: "pending",
  attendees: [{ name: "Jane", email: "jane@example.com" }],
};

type Sent = { method: string; path: string; body: unknown };

/** Serves the pending booking, answering actions with the queued responses or else the changed booking. */
async function renderPending(actionResponses: Response[] = []) {
  const sent: Sent[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const path = new URL(request.url).pathname;
    const text = await request.text();
    sent.push({ method: request.method, path, body: text ? JSON.parse(text) : null });
    if (request.method !== "POST") return bookingResponse(pending);
    const queued = actionResponses.shift();
    if (queued) return queued;
    const status = path.endsWith("/confirm") ? "accepted" : "rejected";
    return jsonResponse({ status: "success", data: apiBooking({ ...pending, status }) });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: "/booking/b1" });
  await screen.findByRole("header", { name: "Itinerary review" });
  return sent;
}

const actions = (sent: Sent[]) => sent.filter((request) => request.method === "POST");

describe("confirming and declining", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("confirms an unconfirmed booking", async () => {
    const sent = await renderPending();

    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.confirm }));

    expect(await screen.findByText(en.bookingActions.confirmed)).toBeOnTheScreen();
    expect(actions(sent)).toEqual([{ method: "POST", path: "/api/v2/bookings/b1/confirm", body: null }]);
    expect(screen.queryByText(en.bookings.status.pending)).toBeNull();
    expect(screen.queryByRole("button", { name: en.bookingActions.confirm })).toBeNull();
  });

  it("explains why confirming failed and lets you try again", async () => {
    await renderPending([
      jsonResponse(
        { status: "error", error: { message: "This booking has already been confirmed" } },
        { status: 400 }
      ),
    ]);

    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.confirm }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your Cal.diy server said: “This booking has already been confirmed”"
    );
    expect(screen.getByRole("button", { name: en.bookingActions.confirm })).toBeOnTheScreen();
  });

  it("declines with a reason and returns to the booking", async () => {
    const sent = await renderPending();

    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.decline }));
    expect(await screen.findByRole("header", { name: en.bookingActions.declineTitle })).toBeOnTheScreen();
    expect(screen.getByText("Cal.diy will email Jane that the booking was declined.")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(en.bookingActions.declineReasonLabel), "Fully booked");
    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.declineSubmit }));

    expect(await screen.findByText(en.bookings.status.rejected)).toBeOnTheScreen();
    expect(screen).toHavePathname("/booking/b1");
    expect(actions(sent)).toEqual([
      { method: "POST", path: "/api/v2/bookings/b1/decline", body: { reason: "Fully booked" } },
    ]);
  });

  it("goes back without declining", async () => {
    const sent = await renderPending();

    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.decline }));
    await fireEvent.press(await screen.findByRole("button", { name: en.bookingActions.goBack }));

    expect(await screen.findByRole("button", { name: en.bookingActions.confirm })).toBeOnTheScreen();
    expect(actions(sent)).toEqual([]);
  });
});
