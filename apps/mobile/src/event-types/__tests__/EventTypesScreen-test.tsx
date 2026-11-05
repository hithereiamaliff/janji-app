import * as Clipboard from "expo-clipboard";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Share } from "react-native";

import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import {
  apiEventType,
  eventTypesResponse,
  jsonResponse,
  privateLinksResponse,
  type TestEventType,
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

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));

const eventTypes: TestEventType[] = [
  { id: 1, title: "Quick call", slug: "30min", lengthInMinutes: 30 },
  { id: 2, title: "Consultation", slug: "consultation", lengthInMinutes: 180, hidden: true },
  { id: 3, title: "Flexible chat", slug: "chat", lengthInMinutes: 30, lengthInMinutesOptions: [15, 60] },
];

type Sent = { method: string; body: unknown };

/** Answers the list with `response`, and a change with `patchResponse` or the changed event type. */
async function renderEventTypes(
  response: () => Response,
  initialUrl = "/event-types",
  patchResponse?: () => Response
) {
  const sent: Sent[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const text = await request.text();
    const body: unknown = text ? JSON.parse(text) : null;
    sent.push({ method: request.method, body });
    if (request.url.endsWith("/private-links")) return privateLinksResponse([]);
    if (request.method !== "PATCH") return response();
    if (patchResponse) return patchResponse();
    const id = Number(new URL(request.url).pathname.split("/").at(-1));
    const changed = eventTypes.find((eventType) => eventType.id === id);
    if (!changed) return jsonResponse({ status: "error", error: { message: "Not found" } }, { status: 404 });
    const hidden = typeof body === "object" && body !== null && "hidden" in body && body.hidden === true;
    return jsonResponse({ status: "success", data: apiEventType({ ...changed, hidden }) });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl });
  return sent;
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

  it("copies or shares the booking link", async () => {
    const share = jest
      .spyOn(Share, "share")
      .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    await renderEventTypes(() => eventTypesResponse(eventTypes), "/event-type/2");
    const link = "https://book.example.com/alan/consultation";

    expect(await screen.findByText(link)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: en.eventTypes.copyLink }));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(link);
    expect(await screen.findByText(en.eventTypes.linkCopied)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: en.eventTypes.share }));
    // jest-expo runs as iOS, where the link is shared as a url so the sheet can show a preview.
    expect(share).toHaveBeenCalledWith({ url: link });
  });

  it("shows a hidden event type on the booking page", async () => {
    const sent = await renderEventTypes(() => eventTypesResponse(eventTypes), "/event-type/2");

    const toggle = await screen.findByRole("switch", { name: en.eventTypes.showOnPage });
    expect(toggle).not.toBeChecked();
    await fireEvent(toggle, "valueChange", true);

    await waitFor(() => expect(screen.getByRole("switch", { name: en.eventTypes.showOnPage })).toBeChecked());
    expect(screen.queryByText(en.eventTypes.hidden)).toBeNull();
    expect(sent.filter((request) => request.method === "PATCH")).toEqual([
      { method: "PATCH", body: { hidden: false } },
    ]);
  });

  it("puts the switch back and explains when the change fails", async () => {
    await renderEventTypes(
      () => eventTypesResponse(eventTypes),
      "/event-type/2",
      () => jsonResponse({ status: "error", error: { message: "Event type not found" } }, { status: 404 })
    );

    await fireEvent(
      await screen.findByRole("switch", { name: en.eventTypes.showOnPage }),
      "valueChange",
      true
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(en.eventTypes.notFound);
    expect(screen.getByRole("switch", { name: en.eventTypes.showOnPage })).not.toBeChecked();
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
