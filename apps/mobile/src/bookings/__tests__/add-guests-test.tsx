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

// Relative to now, because guests are offered only on bookings that haven't ended.
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

/** Serves the booking, answering a request to add guests with the queued response or the booking with them. */
async function renderBooking(actionResponses: Response[] = []) {
  const sent: Sent[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const text = await request.text();
    sent.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: text ? JSON.parse(text) : null,
    });
    if (request.method !== "POST") return bookingResponse(upcoming);
    const queued = actionResponses.shift();
    if (queued) return queued;
    const attendees = [...(upcoming.attendees ?? []), { name: "Lee", email: "lee@example.com" }];
    return jsonResponse({ status: "success", data: apiBooking({ ...upcoming, attendees }) });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: "/booking/b1" });
  await screen.findByRole("header", { name: upcoming.title });
  return sent;
}

async function openForm() {
  await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.addGuests }));
  return screen.findByLabelText(en.bookingActions.guestEmailsLabel);
}

const actions = (sent: Sent[]) => sent.filter((request) => request.method === "POST");

describe("adding guests", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("adds guests and returns to the booking, which lists them", async () => {
    const sent = await renderBooking();

    await fireEvent.changeText(await openForm(), "lee@example.com");
    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.addGuestsSubmit }));

    expect(await screen.findByText("Lee")).toBeOnTheScreen();
    expect(screen).toHavePathname("/booking/b1");
    expect(actions(sent)).toEqual([
      {
        method: "POST",
        path: "/api/v2/bookings/b1/guests",
        body: { guests: [{ email: "lee@example.com", language: "en" }] },
      },
    ]);
  });

  it("checks the addresses before sending anything", async () => {
    const sent = await renderBooking();
    const field = await openForm();

    await fireEvent.changeText(field, "lee@example.com, kim@");
    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.addGuestsSubmit }));
    expect(await screen.findByRole("alert")).toHaveTextContent("These don't look like email addresses: kim@");

    await fireEvent.changeText(field, "jane@example.com");
    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.addGuestsSubmit }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Already on this booking: jane@example.com");

    expect(actions(sent)).toEqual([]);
  });

  it("explains when Cal.diy couldn't add anyone", async () => {
    await renderBooking([
      jsonResponse({ status: "error", error: { message: "emails_must_be_unique_valid" } }, { status: 400 }),
    ]);

    await fireEvent.changeText(await openForm(), "blocked@example.com");
    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.addGuestsSubmit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(en.bookingActions.guestEmailsRejected);
  });
});
