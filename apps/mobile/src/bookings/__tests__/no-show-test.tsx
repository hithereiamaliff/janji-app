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

// Relative to now, because no-shows can only be marked once a booking has started.
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

const started: TestBooking = {
  uid: "b1",
  title: "Itinerary review",
  start: hoursFromNow(-2),
  end: hoursFromNow(-1),
  attendees: [
    // Jane's address carries the alias API v2 adds, so marking her must use the stored form.
    { name: "Jane", email: "jane+a1b2c3d4e5f6g7h8i9j0k1l2m@example.com", displayEmail: "jane@example.com" },
    { name: "Sam", email: "sam@example.com", absent: true },
  ],
};

type Sent = { method: string; path: string; body: unknown };

/** The `{ attendees: [{ email, absent }] }` a mark-absent request sends, as email → absent. */
function absentChanges(body: unknown): Map<string, boolean> {
  const changes = new Map<string, boolean>();
  if (typeof body !== "object" || body === null || !("attendees" in body)) return changes;
  const attendees: unknown = body.attendees;
  if (!Array.isArray(attendees)) return changes;
  const list: unknown[] = attendees;
  for (const change of list) {
    if (typeof change !== "object" || change === null) continue;
    if (
      "email" in change &&
      "absent" in change &&
      typeof change.email === "string" &&
      typeof change.absent === "boolean"
    ) {
      changes.set(change.email, change.absent);
    }
  }
  return changes;
}

/** Serves `shown`, answering a no-show change with the booking as Cal.diy would then have it. */
async function renderBooking(shown: TestBooking, actionResponses: Response[] = []) {
  const sent: Sent[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const text = await request.text();
    const body: unknown = text ? JSON.parse(text) : null;
    sent.push({ method: request.method, path: new URL(request.url).pathname, body });
    if (request.method !== "POST") return bookingResponse(shown);
    const queued = actionResponses.shift();
    if (queued) return queued;
    const changes = absentChanges(body);
    const attendees = (shown.attendees ?? []).map((attendee) => ({
      ...attendee,
      absent: changes.get(attendee.email) ?? attendee.absent,
    }));
    return jsonResponse({ status: "success", data: apiBooking({ ...shown, attendees }) });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: `/booking/${shown.uid}` });
  await screen.findByRole("header", { name: shown.title });
  return sent;
}

const actions = (sent: Sent[]) => sent.filter((request) => request.method === "POST");

describe("marking no-shows", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("marks an attendee as a no-show by the address Cal.diy stores", async () => {
    const sent = await renderBooking(started);

    await fireEvent.press(screen.getByRole("button", { name: "Mark Jane as a no-show" }));

    expect(await screen.findByRole("button", { name: "Undo no-show for Jane" })).toBeOnTheScreen();
    expect(screen.getAllByText(en.bookingDetail.noShow)).toHaveLength(2);
    expect(actions(sent)).toEqual([
      {
        method: "POST",
        path: "/api/v2/bookings/b1/mark-absent",
        body: { attendees: [{ email: "jane+a1b2c3d4e5f6g7h8i9j0k1l2m@example.com", absent: true }] },
      },
    ]);
  });

  it("clears a no-show", async () => {
    const sent = await renderBooking(started);

    await fireEvent.press(screen.getByRole("button", { name: "Undo no-show for Sam" }));

    expect(await screen.findByRole("button", { name: "Mark Sam as a no-show" })).toBeOnTheScreen();
    expect(screen.queryByText(en.bookingDetail.noShow)).toBeNull();
    expect(actions(sent)[0]?.body).toEqual({ attendees: [{ email: "sam@example.com", absent: false }] });
  });

  it("explains a failed change", async () => {
    await renderBooking(started, [
      jsonResponse({ status: "error", error: { message: "Server error" } }, { status: 500 }),
    ]);

    await fireEvent.press(screen.getByRole("button", { name: "Mark Jane as a no-show" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(en.loadErrors.server_error);
    expect(screen.getByRole("button", { name: "Mark Jane as a no-show" })).toBeOnTheScreen();
  });

  it("doesn't offer no-shows before the booking starts", async () => {
    await renderBooking({ ...started, start: hoursFromNow(1), end: hoursFromNow(2) });

    expect(screen.queryByRole("button", { name: "Mark Jane as a no-show" })).toBeNull();
  });
});
