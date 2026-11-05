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

const consultation: TestSchedule = {
  id: 1,
  name: "Consultation hours",
  isDefault: true,
  availability: [
    { days: ["Sunday", "Monday", "Tuesday", "Friday", "Saturday"], startTime: "10:00", endTime: "18:00" },
  ],
};
const weekends: TestSchedule = {
  id: 3,
  name: "Weekends",
  timeZone: "Europe/London",
  availability: [{ days: ["Saturday", "Sunday"], startTime: "09:00", endTime: "12:30" }],
};

/** Opens the Availability tab, serving `served` and deleting from it as Cal.diy would. */
async function renderSchedules(served: TestSchedule[]) {
  let schedules = served;
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    if (request.method === "DELETE") {
      const id = Number(new URL(request.url).pathname.split("/").at(-1));
      const deleted = schedules.find((schedule) => schedule.id === id) ?? weekends;
      schedules = schedules.filter((schedule) => schedule.id !== id);
      return jsonResponse({ status: "success", data: apiSchedule(deleted) });
    }
    return schedulesResponse(schedules);
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: "/availability" });
}

const rowNames = () =>
  screen.getAllByRole("button", { name: /hours|Weekends/ }).map((row) => row.props.accessibilityLabel);

describe("Availability", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("lists the schedules, the default first, with their weekly hours and time zone", async () => {
    await renderSchedules([weekends, consultation]);

    await screen.findByRole("button", { name: /^Weekends/ });
    expect(rowNames()).toEqual([
      "Consultation hours, Default, Mon, Tue, Fri–Sun, 10:00 AM – 6:00 PM, Kuala Lumpur time",
      "Weekends, Sat, Sun, 9:00 AM – 12:30 PM, London time",
    ]);
  });

  it("says when there are none", async () => {
    await renderSchedules([]);

    expect(await screen.findByText(en.availability.empty)).toBeOnTheScreen();
  });

  it("explains when the schedules don't load", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        jsonResponse({ status: "error", error: { message: "Forbidden" } }, { status: 403 })
      );
    await saveSession({ account: testAccount, apiKey: "cal_secret" });
    await renderRouter(appRoutes, { initialUrl: "/availability" });

    expect(await screen.findByRole("alert")).toHaveTextContent(en.availability.loadFailed);
  });

  it("opens a schedule", async () => {
    await renderSchedules([consultation, weekends]);

    await fireEvent.press(await screen.findByRole("button", { name: /^Weekends/ }));

    expect(await screen.findByRole("header", { name: "Weekends" })).toBeOnTheScreen();
    expect(screen).toHavePathname("/schedule/3");
  });

  it("no longer lists a schedule once it's deleted", async () => {
    await renderSchedules([consultation, weekends]);
    await fireEvent.press(await screen.findByRole("button", { name: /^Weekends/ }));

    await fireEvent.press(await screen.findByRole("button", { name: en.availability.delete }));
    await fireEvent.press(screen.getByRole("button", { name: en.availability.deleteConfirm }));

    await waitFor(() => expect(screen).toHavePathname("/availability"));
    // The list catches up with the deletion a moment after the screen closes.
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Weekends/ })).toBeNull());
    expect(rowNames()).toEqual([
      "Consultation hours, Default, Mon, Tue, Fri–Sun, 10:00 AM – 6:00 PM, Kuala Lumpur time",
    ]);
  });
});
