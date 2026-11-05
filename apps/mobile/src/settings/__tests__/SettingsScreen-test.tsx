import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import { jsonResponse, testAccount, testMeResponse } from "@/test-utils/fixtures";

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

/** Opens Settings. The profile is answered with `profile` in turn, then as `me` describes it. */
async function openSettings(me: Partial<typeof testMeResponse.data> = {}, profile: Response[] = []) {
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    if (request.url.endsWith("/v2/me")) {
      return profile.shift() ?? jsonResponse({ ...testMeResponse, data: { ...testMeResponse.data, ...me } });
    }
    return jsonResponse({ status: "success", data: [] });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: "/settings" });
}

describe("Settings", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("shows the account and the profile settings the app follows", async () => {
    await openSettings();

    expect(await screen.findByLabelText("Weeks start on, Monday")).toBeOnTheScreen();
    expect(screen.getByText("Alan")).toBeOnTheScreen();
    expect(screen.getByText("alan@example.com")).toBeOnTheScreen();
    expect(screen.getByText("Server: book.example.com")).toBeOnTheScreen();
    expect(screen.getByLabelText("Time zone, Kuala Lumpur (Asia/Kuala_Lumpur)")).toBeOnTheScreen();
    expect(screen.getByLabelText("Clock, 12-hour, such as 1:00 PM")).toBeOnTheScreen();
  });

  it("shows a 24-hour clock and weeks that start on Sunday", async () => {
    await openSettings({ timeFormat: 24, weekStart: "Sunday" });

    expect(await screen.findByLabelText("Clock, 24-hour, such as 13:00")).toBeOnTheScreen();
    expect(screen.getByLabelText("Weeks start on, Sunday")).toBeOnTheScreen();
  });

  it("explains a profile that didn't load, and tries again", async () => {
    // A 400 isn't retried on its own, so the error stays until Try again.
    await openSettings({}, [jsonResponse({ status: "error", error: { message: "bad" } }, { status: 400 })]);

    expect(await screen.findByRole("alert")).toHaveTextContent(en.settings.profile.loadFailed);
    await fireEvent.press(screen.getByRole("button", { name: en.loadErrors.retry }));

    expect(await screen.findByLabelText("Weeks start on, Monday")).toBeOnTheScreen();
  });
});
