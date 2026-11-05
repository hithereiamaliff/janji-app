import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import {
  apiSchedule,
  jsonResponse,
  schedulesResponse,
  type TestSchedule,
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

const splitWeek: TestSchedule = {
  id: 3,
  name: "Split week",
  availability: [
    { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], startTime: "09:00", endTime: "12:00" },
    { days: ["Monday", "Tuesday", "Wednesday", "Thursday"], startTime: "13:00", endTime: "17:00" },
    { days: ["Saturday"], startTime: "10:00", endTime: "13:00" },
  ],
};

/** Opens the hours editor from the schedule's screen. Saved hours are answered as Cal.diy would. */
async function openEditor(changeResponse?: () => Response) {
  const patches: unknown[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    if (request.method !== "PATCH") return schedulesResponse([splitWeek]);
    const body: unknown = await request.json();
    patches.push(body);
    if (changeResponse) return changeResponse();
    const availability =
      typeof body === "object" && body !== null && "availability" in body && Array.isArray(body.availability)
        ? body.availability
        : [];
    return jsonResponse({ status: "success", data: { ...apiSchedule(splitWeek), availability } });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: "/schedule/3" });
  await fireEvent.press(await screen.findByRole("button", { name: en.availability.hours.action }));
  await screen.findByRole("header", { name: en.availability.hours.title });
  return patches;
}

async function pickTime(field: string, time: string) {
  await fireEvent.press(screen.getByRole("button", { name: field }));
  await fireEvent.press(screen.getByRole("button", { name: time }));
}

async function save() {
  await fireEvent.press(screen.getByRole("button", { name: en.availability.hours.save }));
}

describe("editing weekly hours", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("starts from the schedule's hours, day by day", async () => {
    await openEditor();

    expect(screen.getByRole("switch", { name: "Open on Monday" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Monday, start, 9:00 AM" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Monday, end, 5:00 PM" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Saturday, start, 10:00 AM" })).toBeOnTheScreen();
    expect(screen.getByRole("switch", { name: "Open on Sunday" })).not.toBeChecked();
  });

  it("saves the hours as Cal.diy keeps them, then shows them", async () => {
    const patches = await openEditor();

    await fireEvent.press(screen.getByRole("button", { name: "Remove Monday, 1:00 PM – 5:00 PM" }));
    await pickTime("Saturday, end, 1:00 PM", "2:00 PM");
    await fireEvent(screen.getByRole("switch", { name: "Open on Sunday" }), "valueChange", true);
    await save();

    await waitFor(() => expect(screen).toHavePathname("/schedule/3"));
    expect(patches).toEqual([
      {
        availability: [
          {
            days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            startTime: "09:00",
            endTime: "12:00",
          },
          { days: ["Tuesday", "Wednesday", "Thursday"], startTime: "13:00", endTime: "17:00" },
          { days: ["Saturday"], startTime: "10:00", endTime: "14:00" },
          { days: ["Sunday"], startTime: "09:00", endTime: "17:00" },
        ],
      },
    ]);
    expect(await screen.findByText("Sat, 10:00 AM – 2:00 PM")).toBeOnTheScreen();
  });

  it("brings a day's hours back when it's switched off and on again", async () => {
    await openEditor();

    await fireEvent(screen.getByRole("switch", { name: "Open on Monday" }), "valueChange", false);
    expect(screen.queryByRole("button", { name: "Monday, start, 9:00 AM" })).toBeNull();
    await fireEvent(screen.getByRole("switch", { name: "Open on Monday" }), "valueChange", true);

    expect(screen.getByRole("button", { name: "Monday, start, 9:00 AM" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Monday, start, 1:00 PM" })).toBeOnTheScreen();
  });

  it("adds hours after a day's last range", async () => {
    await openEditor();

    await fireEvent.press(screen.getByHintText("Adds more hours on Saturday"));

    expect(screen.getByRole("button", { name: "Saturday, start, 1:00 PM" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Saturday, end, 2:00 PM" })).toBeOnTheScreen();
  });

  it("explains hours that don't make sense, and sends nothing", async () => {
    const patches = await openEditor();

    await pickTime("Friday, start, 9:00 AM", "1:00 PM");
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.availability.hours.problems.endsBeforeStart
    );
    expect(patches).toEqual([]);
  });

  it("closes without a request when nothing changed", async () => {
    const patches = await openEditor();

    await save();

    await waitFor(() => expect(screen).toHavePathname("/schedule/3"));
    expect(patches).toEqual([]);
  });

  it("keeps the form and explains when saving fails", async () => {
    await openEditor(() =>
      jsonResponse({ status: "error", error: { message: "invalid_input" } }, { status: 400 })
    );

    await fireEvent(screen.getByRole("switch", { name: "Open on Sunday" }), "valueChange", true);
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.availability.hours.failed);
    expect(screen).toHavePathname("/schedule/3/hours");
  });
});
