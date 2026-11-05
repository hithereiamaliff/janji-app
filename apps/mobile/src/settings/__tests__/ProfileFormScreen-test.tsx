import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

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

/** Opens the form from Settings. A change is answered with `changeResponse`, or as Cal.diy would. */
async function openForm(changeResponse?: () => Response) {
  const patches: unknown[] = [];
  let me = testMeResponse.data;
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    if (request.url.endsWith("/v2/timezones")) {
      return jsonResponse({
        status: "success",
        data: [{ city: "London", timezone: "Europe/London", pop: 7556900 }],
      });
    }
    if (!request.url.endsWith("/v2/me")) return jsonResponse({ status: "success", data: [] });
    if (request.method === "PATCH") {
      const body: unknown = await request.json();
      patches.push(body);
      if (changeResponse) return changeResponse();
      me = { ...me, ...(typeof body === "object" && body !== null ? body : {}) };
    }
    return jsonResponse({ ...testMeResponse, data: me });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: "/settings" });
  await fireEvent.press(await screen.findByRole("button", { name: en.settings.edit.action }));
  await screen.findByRole("header", { name: en.settings.edit.title });
  return patches;
}

const save = () => fireEvent.press(screen.getByRole("button", { name: en.settings.edit.save }));

describe("editing the profile", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("starts from the profile as it is", async () => {
    await openForm();

    expect(screen.getByLabelText(en.settings.edit.nameLabel)).toHaveDisplayValue("Alan");
    expect(
      screen.getByRole("button", { name: "Time zone, Kuala Lumpur (Asia/Kuala_Lumpur)" })
    ).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "12-hour (1:00 PM)" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "24-hour (13:00)" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Monday" })).toBeChecked();
  });

  it("saves only what changed, then shows it in Settings", async () => {
    const patches = await openForm();

    await fireEvent.press(screen.getByRole("radio", { name: "24-hour (13:00)" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Sunday" }));
    await save();

    await waitFor(() => expect(screen).toHavePathname("/settings"));
    expect(patches).toEqual([{ timeFormat: 24, weekStart: "Sunday" }]);
    expect(await screen.findByLabelText("Clock, 24-hour, such as 13:00")).toBeOnTheScreen();
    expect(screen.getByLabelText("Weeks start on, Sunday")).toBeOnTheScreen();
  });

  it("saves a new name and time zone", async () => {
    const patches = await openForm();

    await fireEvent.changeText(screen.getByLabelText(en.settings.edit.nameLabel), " Alan R ");
    await fireEvent.press(
      screen.getByRole("button", { name: "Time zone, Kuala Lumpur (Asia/Kuala_Lumpur)" })
    );
    await fireEvent.changeText(screen.getByLabelText(en.timeZonePicker.searchLabel), "lon");
    await fireEvent.press(await screen.findByRole("button", { name: "London, Europe/London" }));
    await save();

    await waitFor(() => expect(patches).toEqual([{ name: "Alan R", timeZone: "Europe/London" }]));
    expect(await screen.findByText("Alan R")).toBeOnTheScreen();
  });

  it("closes without a request when nothing changed", async () => {
    const patches = await openForm();

    await save();

    await waitFor(() => expect(screen).toHavePathname("/settings"));
    expect(patches).toEqual([]);
  });

  it("needs a name", async () => {
    const patches = await openForm();

    await fireEvent.changeText(screen.getByLabelText(en.settings.edit.nameLabel), "  ");
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.settings.edit.nameMissing);
    expect(patches).toEqual([]);
  });

  it("keeps the form and explains when saving fails", async () => {
    await openForm(() =>
      jsonResponse({ status: "error", error: { message: "invalid_input" } }, { status: 400 })
    );

    await fireEvent.press(screen.getByRole("radio", { name: "Sunday" }));
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.settings.edit.failed);
    expect(screen).toHavePathname("/profile");
  });
});
