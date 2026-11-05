import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import { eventTypesResponse, jsonResponse, type TestEventType, testAccount } from "@/test-utils/fixtures";

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

const eventTypes: TestEventType[] = [
  { id: 1, title: "Quick call", slug: "30min", lengthInMinutes: 30 },
  { id: 2, title: "Consultation", slug: "consultation", lengthInMinutes: 180, hidden: true },
  { id: 3, title: "Flexible chat", slug: "chat", lengthInMinutes: 30, lengthInMinutesOptions: [15, 60] },
];

async function renderEventTypes(response: () => Response, initialUrl = "/event-types") {
  jest.spyOn(globalThis, "fetch").mockImplementation(async () => response());
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl });
}

describe("Event types", () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });
  afterEach(() => jest.restoreAllMocks());

  it("lists event types with their lengths, links and visibility", async () => {
    await renderEventTypes(() => eventTypesResponse(eventTypes));

    expect(await screen.findByRole("button", { name: "Quick call, 30 min" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Consultation, 3 hr, Hidden" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Flexible chat, 15 min, 30 min, 1 hr" })).toBeOnTheScreen();
    expect(screen.getByText("book.example.com/alan/consultation")).toBeOnTheScreen();
  });

  it("says when there are none yet", async () => {
    await renderEventTypes(() => eventTypesResponse([]));

    expect(await screen.findByText(en.eventTypes.empty)).toBeOnTheScreen();
  });

  it("explains a failed load", async () => {
    await renderEventTypes(() =>
      jsonResponse({ status: "error", error: { message: "Invalid API Key" } }, { status: 401 })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(en.loadErrors.unauthorized);
  });

  it("opens an event type", async () => {
    await renderEventTypes(() => eventTypesResponse(eventTypes));

    await fireEvent.press(await screen.findByRole("button", { name: "Consultation, 3 hr, Hidden" }));

    expect(await screen.findByRole("header", { name: "Consultation" })).toBeOnTheScreen();
    expect(screen).toHavePathname("/event-type/2");
    expect(screen.getByText(en.eventTypes.hidden)).toBeOnTheScreen();
  });

  it("says which length a booking gets when there's a choice", async () => {
    await renderEventTypes(() => eventTypesResponse(eventTypes), "/event-type/3");

    expect(
      await screen.findByText(
        "15 min, 30 min, 1 hr. Bookings are 30 min unless the booker picks another length."
      )
    ).toBeOnTheScreen();
  });

  it("says when an event type no longer exists", async () => {
    await renderEventTypes(() => eventTypesResponse(eventTypes), "/event-type/99");

    expect(await screen.findByRole("alert")).toHaveTextContent(en.eventTypes.notFound);
  });
});
