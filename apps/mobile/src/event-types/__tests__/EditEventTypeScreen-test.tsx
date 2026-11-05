import { focusManager } from "@tanstack/react-query";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import {
  apiEventType,
  eventTypesResponse,
  jsonResponse,
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

const consultation: TestEventType = {
  id: 2,
  title: "Consultation",
  slug: "consultation",
  lengthInMinutes: 60,
  description: "A first chat about your project.",
  minimumBookingNotice: 120,
};
const flexible: TestEventType = {
  id: 3,
  title: "Flexible chat",
  slug: "chat",
  lengthInMinutes: 30,
  lengthInMinutesOptions: [15, 30, 60],
};
const eventTypes: TestEventType[] = [
  { id: 1, title: "Quick call", slug: "30min", lengthInMinutes: 30 },
  consultation,
  flexible,
];

/** What the server holds now, which a test can change as if someone edited it on the web. */
let served = eventTypes;

type Sent = { method: string; path: string; body: unknown };

/** Opens the event type's screen. Changes are answered with the queued responses, in order. */
async function renderEventType(eventType: TestEventType, changeResponses: Response[] = []) {
  const sent: Sent[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const text = await request.text();
    sent.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: text ? JSON.parse(text) : null,
    });
    if (request.method !== "PATCH") return eventTypesResponse(served);
    return changeResponses.shift() ?? jsonResponse({ status: "success", data: apiEventType(eventType) });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: `/event-type/${eventType.id}` });
  await fireEvent.press(await screen.findByRole("button", { name: en.eventTypes.edit.action }));
  await screen.findByRole("header", { name: en.eventTypes.edit.title });
  return sent;
}

function saved(eventType: TestEventType): Response {
  return jsonResponse({ status: "success", data: apiEventType(eventType) });
}

const changes = (sent: Sent[]) => sent.filter((request) => request.method === "PATCH");

async function save() {
  await fireEvent.press(screen.getByRole("button", { name: en.eventTypes.edit.save }));
}

describe("editing an event type", () => {
  beforeEach(() => {
    mockStore.clear();
    served = eventTypes;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    focusManager.setFocused(undefined);
  });

  it("starts from the event type's current settings", async () => {
    await renderEventType(consultation);

    expect(screen.getByLabelText(en.eventTypes.edit.titleLabel)).toHaveDisplayValue("Consultation");
    expect(screen.getByLabelText(en.eventTypes.edit.slugLabel)).toHaveDisplayValue("consultation");
    expect(screen.getByLabelText(en.eventTypes.edit.lengthLabel)).toHaveDisplayValue("60");
    expect(screen.getByLabelText(en.eventTypes.edit.noticeLabel)).toHaveDisplayValue("2");
    expect(screen.getByRole("tab", { name: en.eventTypes.edit.units.hours })).toBeSelected();
    expect(screen.getByLabelText(en.eventTypes.edit.descriptionLabel)).toHaveDisplayValue(
      "A first chat about your project."
    );
    expect(screen.getByText("Your booking link: book.example.com/alan/consultation")).toBeOnTheScreen();
  });

  it("saves only what changed, then shows the event type as saved", async () => {
    const sent = await renderEventType(consultation, [
      saved({ ...consultation, title: "Discovery call", slug: "discovery-call", minimumBookingNotice: 1440 }),
    ]);

    await fireEvent.changeText(screen.getByLabelText(en.eventTypes.edit.titleLabel), "Discovery call");
    await fireEvent.changeText(screen.getByLabelText(en.eventTypes.edit.slugLabel), "Discovery Call");
    expect(
      screen.getByText(
        "Your new booking link: book.example.com/alan/discovery-call. The old link will stop working."
      )
    ).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(en.eventTypes.edit.noticeLabel), "1");
    await fireEvent.press(screen.getByRole("tab", { name: en.eventTypes.edit.units.days }));
    await save();

    await waitFor(() => expect(screen).toHavePathname("/event-type/2"));
    expect(await screen.findByRole("header", { name: "Discovery call" })).toBeOnTheScreen();
    expect(screen.getByText("https://book.example.com/alan/discovery-call")).toBeOnTheScreen();
    expect(changes(sent)).toEqual([
      {
        method: "PATCH",
        path: "/api/v2/event-types/2",
        body: { title: "Discovery call", slug: "discovery-call", minimumBookingNotice: 1440 },
      },
    ]);
  });

  it("closes without a request when nothing changed", async () => {
    const sent = await renderEventType(consultation);

    await save();

    await waitFor(() => expect(screen).toHavePathname("/event-type/2"));
    expect(changes(sent)).toEqual([]);
  });

  it("explains what needs fixing and sends nothing", async () => {
    const sent = await renderEventType(consultation);

    await fireEvent.changeText(screen.getByLabelText(en.eventTypes.edit.titleLabel), " ");
    await fireEvent.changeText(screen.getByLabelText(en.eventTypes.edit.slugLabel), "30MIN");
    await fireEvent.changeText(screen.getByLabelText(en.eventTypes.edit.lengthLabel), "0");
    await fireEvent.changeText(screen.getByLabelText(en.eventTypes.edit.noticeLabel), "soon");
    await save();

    expect(await screen.findByText(en.eventTypes.edit.errors.titleMissing)).toBeOnTheScreen();
    expect(screen.getByText(en.eventTypes.edit.errors.slugTaken)).toBeOnTheScreen();
    expect(screen.getByText(en.eventTypes.edit.errors.lengthInvalid)).toBeOnTheScreen();
    expect(screen.getByText(en.eventTypes.edit.errors.noticeInvalid)).toBeOnTheScreen();
    expect(screen).toHavePathname("/event-type/2/edit");
    expect(changes(sent)).toEqual([]);
  });

  it("picks the default from the lengths on offer", async () => {
    const sent = await renderEventType(flexible, [saved({ ...flexible, lengthInMinutes: 60 })]);

    expect(screen.queryByLabelText(en.eventTypes.edit.lengthLabel)).toBeNull();
    expect(screen.getByRole("tab", { name: "30 min" })).toBeSelected();
    await fireEvent.press(screen.getByRole("tab", { name: "1 hr" }));
    await save();

    expect(
      await screen.findByText(
        "15 min, 30 min, 1 hr. Bookings are 1 hr unless the booker picks another length."
      )
    ).toBeOnTheScreen();
    expect(changes(sent).map((request) => request.body)).toEqual([{ lengthInMinutes: 60 }]);
  });

  it("keeps the form and explains when saving fails", async () => {
    await renderEventType(consultation, [
      jsonResponse({ status: "error", error: { message: "invalid_input" } }, { status: 400 }),
    ]);

    await fireEvent.changeText(screen.getByLabelText(en.eventTypes.edit.titleLabel), "Discovery call");
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.eventTypes.edit.failed);
    expect(screen.getByLabelText(en.eventTypes.edit.titleLabel)).toHaveDisplayValue("Discovery call");
    expect(screen).toHavePathname("/event-type/2/edit");
  });

  it("says so under the link when another event type took it meanwhile", async () => {
    await renderEventType(consultation, [
      jsonResponse(
        { status: "error", error: { code: "TRPCError", message: "error_event_type_url_duplicate" } },
        { status: 400 }
      ),
    ]);

    await fireEvent.changeText(screen.getByLabelText(en.eventTypes.edit.slugLabel), "planning");
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.eventTypes.edit.errors.slugTaken);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("doesn't put back a setting someone changed on the web while the form was open", async () => {
    const sent = await renderEventType(consultation);
    served = eventTypes.map((eventType) =>
      eventType.id === consultation.id
        ? { ...eventType, title: "Consultation, renamed on the web" }
        : eventType
    );

    // Coming back to the app a few minutes later fetches the event types again.
    const now = Date.now();
    jest.spyOn(Date, "now").mockImplementation(() => now + 5 * 60_000);
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    // The event type's own screen, under the form, shows the new title once it's in.
    expect(
      await screen.findByText("Consultation, renamed on the web", { includeHiddenElements: true })
    ).toBeOnTheScreen();

    await fireEvent.changeText(
      screen.getByLabelText(en.eventTypes.edit.descriptionLabel),
      "What we'll cover."
    );
    await save();

    await waitFor(() => expect(screen).toHavePathname("/event-type/2"));
    expect(changes(sent).map((request) => request.body)).toEqual([{ description: "What we'll cover." }]);
  });
});
