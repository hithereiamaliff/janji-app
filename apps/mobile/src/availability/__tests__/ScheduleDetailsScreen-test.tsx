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

const weekends: TestSchedule = { id: 3, name: "Weekends", timeZone: "Europe/London" };

/** Opens the form from the schedule's screen. A change is answered with `changeResponse`, or as Cal.diy would. */
async function openForm(changeResponse?: () => Response) {
  const patches: unknown[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    if (request.url.endsWith("/v2/timezones")) {
      return jsonResponse({
        status: "success",
        data: [
          { city: "Penang", timezone: "Asia/Kuala_Lumpur", pop: 708127 },
          { city: "London", timezone: "Europe/London", pop: 7556900 },
        ],
      });
    }
    if (request.method !== "PATCH") return schedulesResponse([weekends]);
    const body: unknown = await request.json();
    patches.push(body);
    if (changeResponse) return changeResponse();
    const changes = typeof body === "object" && body !== null ? body : {};
    return jsonResponse({ status: "success", data: { ...apiSchedule(weekends), ...changes } });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: "/schedule/3" });
  await fireEvent.press(await screen.findByRole("button", { name: en.availability.details.action }));
  await screen.findByRole("header", { name: en.availability.details.title });
  return patches;
}

async function save() {
  await fireEvent.press(screen.getByRole("button", { name: en.availability.details.save }));
}

describe("a schedule's name and time zone", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("starts from the schedule's own", async () => {
    await openForm();

    expect(screen.getByLabelText(en.availability.details.nameLabel)).toHaveDisplayValue("Weekends");
    expect(screen.getByRole("button", { name: "Time zone, London (Europe/London)" })).toBeOnTheScreen();
  });

  it("saves a new name and time zone, then shows them", async () => {
    const patches = await openForm();

    await fireEvent.changeText(
      screen.getByLabelText(en.availability.details.nameLabel),
      " Weekends in Penang "
    );
    await fireEvent.press(screen.getByRole("button", { name: "Time zone, London (Europe/London)" }));
    await fireEvent.changeText(screen.getByLabelText(en.timeZonePicker.searchLabel), "pen");
    await fireEvent.press(await screen.findByRole("button", { name: "Penang, Asia/Kuala_Lumpur" }));
    await save();

    await waitFor(() => expect(screen).toHavePathname("/schedule/3"));
    expect(patches).toEqual([{ name: "Weekends in Penang", timeZone: "Asia/Kuala_Lumpur" }]);
    expect(await screen.findByRole("header", { name: "Weekends in Penang" })).toBeOnTheScreen();
    expect(screen.getByText("Kuala Lumpur (Asia/Kuala_Lumpur)")).toBeOnTheScreen();
  });

  it("sends only what changed", async () => {
    const patches = await openForm();

    await fireEvent.changeText(screen.getByLabelText(en.availability.details.nameLabel), "Saturdays");
    await save();

    await waitFor(() => expect(patches).toEqual([{ name: "Saturdays" }]));
  });

  it("closes without a request when nothing changed", async () => {
    const patches = await openForm();

    await save();

    await waitFor(() => expect(screen).toHavePathname("/schedule/3"));
    expect(patches).toEqual([]);
  });

  it("needs a name", async () => {
    const patches = await openForm();

    await fireEvent.changeText(screen.getByLabelText(en.availability.details.nameLabel), "  ");
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.availability.new.nameMissing);
    expect(patches).toEqual([]);
  });

  it("keeps the form and explains when saving fails", async () => {
    await openForm(() =>
      jsonResponse({ status: "error", error: { message: "invalid_input" } }, { status: 400 })
    );

    await fireEvent.changeText(screen.getByLabelText(en.availability.details.nameLabel), "Saturdays");
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.availability.details.failed);
    expect(screen).toHavePathname("/schedule/3/details");
  });
});
