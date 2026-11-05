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
  testMeResponse,
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

const past = { date: "2026-11-04", startTime: "09:00", endTime: "12:00" };
const christmas = [
  { date: "2026-12-24", startTime: "09:00", endTime: "12:00" },
  { date: "2026-12-24", startTime: "13:00", endTime: "15:00" },
  { date: "2026-12-25", startTime: "00:00", endTime: "00:00" },
];
const weekends: TestSchedule = {
  id: 3,
  name: "Weekends",
  timeZone: "Europe/London",
  availability: [{ days: ["Saturday", "Sunday"], startTime: "09:00", endTime: "12:30" }],
  overrides: [past, ...christmas],
};

/** Opens a page on 5 November 2026, the schedule's by default. Changes are answered with `changeResponse`, or as Cal.diy would. */
async function openSchedule(changeResponse?: () => Response, initialUrl = "/schedule/3") {
  const patches: unknown[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    if (request.url.endsWith("/v2/me")) return jsonResponse(testMeResponse);
    if (request.method !== "PATCH") return schedulesResponse([weekends]);
    const body: unknown = await request.json();
    patches.push(body);
    if (changeResponse) return changeResponse();
    const changes = typeof body === "object" && body !== null ? body : {};
    return jsonResponse({ status: "success", data: { ...apiSchedule(weekends), ...changes } });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  // renderRouter starts its fake clock at the time it finds: 9:00 in London.
  jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-05T09:00:00Z"));
  await renderRouter(appRoutes, { initialUrl });
  if (initialUrl === "/schedule/3") await screen.findByRole("header", { name: "Weekends" });
  return patches;
}

async function addOverride() {
  await fireEvent.press(screen.getByRole("button", { name: en.availability.overrides.add }));
  await screen.findByRole("header", { name: en.availability.overrides.addTitle });
}

async function editOverride(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
}

const press = (name: string) => fireEvent.press(screen.getByRole("button", { name }));
const save = () => press(en.availability.overrides.save);
const christmasEve = "Thursday, December 24, 2026, 9:00 AM – 12:00 PM, 1:00 PM – 3:00 PM";

describe("adding date overrides", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("starts from the weekday's hours of the first date picked, then saves them", async () => {
    const patches = await openSchedule();
    await addOverride();

    expect(screen.getByText("November 2026")).toBeOnTheScreen();
    await press("Saturday, November 28, 2026");
    expect(screen.getByRole("button", { name: "Start, 9:00 AM" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "End, 12:30 PM" })).toBeOnTheScreen();
    await save();

    await waitFor(() => expect(screen).toHavePathname("/schedule/3"));
    expect(patches).toEqual([
      {
        overrides: [past, { date: "2026-11-28", startTime: "09:00", endTime: "12:30" }, ...christmas],
      },
    ]);
    expect(
      await screen.findByRole("button", { name: "Saturday, November 28, 2026, 9:00 AM – 12:30 PM" })
    ).toBeOnTheScreen();
  });

  it("makes several dates unavailable all day at once", async () => {
    const patches = await openSchedule();
    await addOverride();

    await press("Tuesday, November 24, 2026");
    await press("Wednesday, November 25, 2026");
    await fireEvent(
      screen.getByRole("switch", { name: en.availability.overrides.unavailable }),
      "valueChange",
      true
    );
    await save();

    await waitFor(() =>
      expect(patches).toEqual([
        {
          overrides: [
            past,
            { date: "2026-11-24", startTime: "00:00", endTime: "00:00" },
            { date: "2026-11-25", startTime: "00:00", endTime: "00:00" },
            ...christmas,
          ],
        },
      ])
    );
  });

  it("starts the calendar's weeks on the person's first day of the week", async () => {
    await openSchedule();
    await addOverride();

    const columns = screen.getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/, { includeHiddenElements: true });
    expect(columns[0]).toHaveTextContent("Mon");
  });

  it("keeps earlier dates, and dates that already have an override, from being picked", async () => {
    await openSchedule();
    await addOverride();

    expect(screen.getByRole("button", { name: "Wednesday, November 4, 2026" })).toBeDisabled();
    await press(en.calendar.nextMonth);
    expect(screen.getByRole("button", { name: "Thursday, December 24, 2026" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Wednesday, December 23, 2026" })).toBeEnabled();
  });

  it("needs a date", async () => {
    const patches = await openSchedule();
    await addOverride();

    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.availability.overrides.noDates);
    expect(patches).toEqual([]);
  });

  it("keeps the form and explains when saving fails", async () => {
    await openSchedule(() =>
      jsonResponse({ status: "error", error: { message: "invalid_input" } }, { status: 400 })
    );
    await addOverride();

    await press("Tuesday, November 24, 2026");
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.availability.overrides.failed);
    expect(screen).toHavePathname("/schedule/3/override/new");
  });
});

describe("changing a date override", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("starts from the date's hours and saves a change to them", async () => {
    const patches = await openSchedule();
    await editOverride(christmasEve);

    expect(await screen.findByRole("header", { name: "Thu, Dec 24, 2026" })).toBeOnTheScreen();
    await press("Remove 1:00 PM – 3:00 PM");
    await save();

    await waitFor(() => expect(screen).toHavePathname("/schedule/3"));
    expect(patches).toEqual([
      {
        overrides: [
          past,
          { date: "2026-12-24", startTime: "09:00", endTime: "12:00" },
          { date: "2026-12-25", startTime: "00:00", endTime: "00:00" },
        ],
      },
    ]);
  });

  it("finds hours that overlap", async () => {
    const patches = await openSchedule();
    await editOverride(christmasEve);

    await press("Start, 1:00 PM");
    await press("11:00 AM");
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.availability.hours.problems.overlaps);
    expect(patches).toEqual([]);
  });

  it("closes without a request when nothing changed", async () => {
    const patches = await openSchedule();
    await editOverride(`Friday, December 25, 2026, ${en.availability.overrides.unavailable}`);

    expect(screen.getByRole("switch", { name: en.availability.overrides.unavailable })).toBeChecked();
    await save();

    await waitFor(() => expect(screen).toHavePathname("/schedule/3"));
    expect(patches).toEqual([]);
  });

  it("removes it, so the date goes back to the weekly hours", async () => {
    const patches = await openSchedule();
    await editOverride(christmasEve);

    await press(en.availability.overrides.remove);

    await waitFor(() => expect(screen).toHavePathname("/schedule/3"));
    expect(patches).toEqual([
      { overrides: [past, { date: "2026-12-25", startTime: "00:00", endTime: "00:00" }] },
    ]);
    await waitFor(() => expect(screen.queryByRole("button", { name: christmasEve })).toBeNull());
  });

  it("sets hours on a date without an override, starting from its weekday's", async () => {
    const patches = await openSchedule(undefined, "/schedule/3/override/2026-11-28");

    expect(await screen.findByRole("header", { name: "Sat, Nov 28, 2026" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Start, 9:00 AM" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "End, 12:30 PM" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: en.availability.overrides.remove })).toBeNull();
    await save();

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({
      overrides: [past, { date: "2026-11-28", startTime: "09:00", endTime: "12:30" }, ...christmas],
    });
  });

  it("goes back to the schedule for an address that isn't a date", async () => {
    await openSchedule(undefined, "/schedule/3/override/soon");

    await waitFor(() => expect(screen).toHavePathname("/schedule/3"));
  });
});
