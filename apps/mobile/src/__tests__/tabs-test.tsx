import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import { bookingsResponse, testAccount } from "@/test-utils/fixtures";

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

// React Navigation labels each tab button "<title>, tab, <n> of <count>" for screen readers.
function getTabButton(title: string) {
  return screen.getByRole("button", { name: new RegExp(`^${title}, tab`) });
}

async function renderSignedIn() {
  await saveSession({ account: testAccount, apiKey: "cal_saved" });
  await renderRouter(appRoutes);
  await screen.findByText(en.bookings.empty.upcoming);
}

describe("tab navigation when signed in", () => {
  beforeEach(() => {
    mockStore.clear();
    jest.spyOn(globalThis, "fetch").mockImplementation(async () => bookingsResponse([]));
  });

  afterEach(() => jest.restoreAllMocks());

  it("opens on the Bookings tab", async () => {
    await renderSignedIn();

    expect(screen).toHavePathname("/");
    expect(getTabButton(en.tabs.bookings)).toBeSelected();
  });

  it("gives every tab an accessible, translated label", async () => {
    await renderSignedIn();

    for (const title of Object.values(en.tabs)) {
      expect(getTabButton(title)).toBeOnTheScreen();
    }
  });

  it("shows the account and server on the Settings tab", async () => {
    await renderSignedIn();

    await fireEvent.press(getTabButton(en.tabs.settings));

    expect(screen).toHavePathname("/settings");
    expect(getTabButton(en.tabs.settings)).toBeSelected();
    expect(screen.getByText("alan@example.com")).toBeOnTheScreen();
    expect(screen.getByText("Server: book.example.com")).toBeOnTheScreen();
  });
});
