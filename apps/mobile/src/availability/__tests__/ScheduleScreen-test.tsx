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

const consultation: TestSchedule = { id: 1, name: "Consultation hours", isDefault: true };
const weekends: TestSchedule = {
  id: 3,
  name: "Weekends",
  timeZone: "Europe/London",
  availability: [{ days: ["Saturday", "Sunday"], startTime: "09:00", endTime: "12:30" }],
  overrides: [
    { date: "2026-12-25", startTime: "00:00", endTime: "00:00" },
    { date: "2026-12-24", startTime: "13:00", endTime: "15:00" },
    { date: "2026-12-24", startTime: "09:00", endTime: "12:00" },
    { date: "2026-11-04", startTime: "09:00", endTime: "12:00" },
  ],
};

type Sent = { method: string; path: string; body: unknown };

/** Opens a schedule's screen. A change is answered with `changeResponse`, or as Cal.diy would. */
async function renderSchedule(id: number, changeResponse?: () => Response) {
  const sent: Sent[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const text = await request.text();
    sent.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: text ? JSON.parse(text) : null,
    });
    if (request.method === "GET") return schedulesResponse([consultation, weekends]);
    if (changeResponse) return changeResponse();
    return jsonResponse({
      status: "success",
      data: apiSchedule({ ...weekends, isDefault: request.method === "PATCH" }),
    });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  // renderRouter starts its fake clock at the time it finds: 9:00 in London on 5 November 2026.
  jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-05T09:00:00Z"));
  await renderRouter(appRoutes, { initialUrl: `/schedule/${id}` });
  return sent;
}

const changes = (sent: Sent[]) => sent.filter((request) => request.method !== "GET");

describe("a schedule", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("shows its weekly hours and time zone", async () => {
    await renderSchedule(3);

    expect(await screen.findByRole("header", { name: "Weekends" })).toBeOnTheScreen();
    expect(screen.getByText("Sat, Sun, 9:00 AM – 12:30 PM")).toBeOnTheScreen();
    expect(screen.getByText("London (Europe/London)")).toBeOnTheScreen();
    expect(screen.getByText(en.availability.notDefault)).toBeOnTheScreen();
  });

  it("shows its date overrides from today on, earliest first", async () => {
    await renderSchedule(3);

    expect(await screen.findByRole("header", { name: "Weekends" })).toBeOnTheScreen();
    expect(screen.getAllByText(/^\w{3}, \w{3} \d+, 2026$/).map((date) => date.props.children)).toEqual([
      "Thu, Dec 24, 2026",
      "Fri, Dec 25, 2026",
    ]);
    expect(
      screen.getByLabelText("Thursday, December 24, 2026, 9:00 AM – 12:00 PM, 1:00 PM – 3:00 PM")
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(`Friday, December 25, 2026, ${en.availability.overrides.unavailable}`)
    ).toBeOnTheScreen();
  });

  it("says when it has no upcoming date overrides", async () => {
    await renderSchedule(1);

    expect(await screen.findByRole("header", { name: "Consultation hours" })).toBeOnTheScreen();
    expect(screen.getByText(en.availability.overrides.none)).toBeOnTheScreen();
  });

  it("can be made the default", async () => {
    const sent = await renderSchedule(3);

    await fireEvent.press(await screen.findByRole("button", { name: en.availability.makeDefault }));

    expect(await screen.findByText(en.availability.isDefault)).toBeOnTheScreen();
    expect(screen.getByText(en.availability.default)).toBeOnTheScreen();
    expect(changes(sent)).toEqual([
      { method: "PATCH", path: "/api/v2/schedules/3", body: { isDefault: true } },
    ]);
  });

  it("can't be deleted while it's the default", async () => {
    await renderSchedule(1);

    expect(await screen.findByText(en.availability.cantDeleteDefault)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: en.availability.delete })).toBeNull();
  });

  it("is deleted once asked to again, and the screen closes", async () => {
    const sent = await renderSchedule(3);

    await fireEvent.press(await screen.findByRole("button", { name: en.availability.delete }));
    expect(
      screen.getByText("Delete Weekends? Event types that use it will use your default schedule instead.")
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: en.availability.deleteConfirm }));

    await waitFor(() => expect(screen).toHavePathname("/availability"));
    expect(changes(sent)).toEqual([{ method: "DELETE", path: "/api/v2/schedules/3", body: null }]);
  });

  it("isn't deleted if Keep it is chosen", async () => {
    const sent = await renderSchedule(3);

    await fireEvent.press(await screen.findByRole("button", { name: en.availability.delete }));
    await fireEvent.press(screen.getByRole("button", { name: en.availability.keep }));

    expect(screen.getByRole("button", { name: en.availability.delete })).toBeOnTheScreen();
    expect(changes(sent)).toEqual([]);
  });

  it("explains a failed delete", async () => {
    await renderSchedule(3, () =>
      jsonResponse(
        { status: "error", error: { message: "Schedule with ID=3 does not exist." } },
        { status: 400 }
      )
    );

    await fireEvent.press(await screen.findByRole("button", { name: en.availability.delete }));
    await fireEvent.press(screen.getByRole("button", { name: en.availability.deleteConfirm }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Schedule with ID=3 does not exist\./);
    expect(screen).toHavePathname("/schedule/3");
  });

  it("says when it no longer exists", async () => {
    await renderSchedule(99);

    expect(await screen.findByRole("alert")).toHaveTextContent(en.availability.notFound);
  });
});
