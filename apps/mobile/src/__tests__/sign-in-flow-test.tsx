import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import en from "@/i18n/locales/en.json";
import { loadSavedSession, saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import { bookingsResponse, jsonResponse, testAccount, testMeResponse } from "@/test-utils/fixtures";

const mockStore = new Map<string, string>();
let mockFailDeletes = false;

jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    if (mockFailDeletes) throw new Error("Keychain unavailable");
    mockStore.delete(key);
  },
}));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("expo-clipboard", () => ({ getStringAsync: jest.fn(async () => "") }));

const { server: serverStrings, apiKey: keyStrings } = en.signIn;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof Request ? input.url : input.href;
}

// A fake Cal.diy server: API v2 answers the probe, /v2/me only accepts cal_secret, and there are no bookings.
function fakeServer(input: RequestInfo | URL): Response {
  const url = requestUrl(input);
  if (url === "https://book.example.com/api/v2/timezones")
    return jsonResponse({ status: "success", data: [] });
  if (url.startsWith("https://book.example.com/api/v2/bookings?")) return bookingsResponse([]);
  if (url === "https://book.example.com/api/v2/me") {
    const authorization = input instanceof Request ? input.headers.get("Authorization") : null;
    return authorization === "Bearer cal_secret"
      ? jsonResponse(testMeResponse)
      : jsonResponse({ status: "error", error: { message: "Your api key is not valid" } }, { status: 401 });
  }
  return new Response("Not found", { status: 404 });
}

async function enterServer(address: string) {
  await fireEvent.changeText(await screen.findByLabelText(serverStrings.addressLabel), address);
  await fireEvent.press(screen.getByRole("button", { name: serverStrings.continue }));
}

async function enterKey(apiKey: string) {
  await fireEvent.changeText(await screen.findByLabelText(keyStrings.keyLabel), apiKey);
  await fireEvent.press(screen.getByRole("button", { name: keyStrings.signIn }));
}

describe("signing in and out", () => {
  beforeEach(() => {
    mockStore.clear();
    mockFailDeletes = false;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => fakeServer(input));
  });

  afterEach(() => jest.restoreAllMocks());

  it("starts on sign-in when no account is saved", async () => {
    await renderRouter(appRoutes);

    expect(await screen.findByRole("header", { name: serverStrings.title })).toBeOnTheScreen();
    expect(screen).toHavePathname("/sign-in");
  });

  it("signs in with a server and an API key, then shows the app", async () => {
    await renderRouter(appRoutes);

    await enterServer("book.example.com");
    expect(await screen.findByRole("header", { name: keyStrings.title })).toBeOnTheScreen();
    await enterKey("cal_secret");

    expect(await screen.findByText(en.bookings.empty.upcoming)).toBeOnTheScreen();
    expect(screen).toHavePathname("/");
    await expect(loadSavedSession()).resolves.toEqual({ account: testAccount, apiKey: "cal_secret" });
  });

  it("stays on the key step when the key is rejected", async () => {
    await renderRouter(appRoutes);

    await enterServer("book.example.com");
    await enterKey("cal_wrong");

    expect(screen.getByRole("alert")).toHaveTextContent(keyStrings.errors.unauthorized);
    expect(screen).toHavePathname("/sign-in");
    await expect(loadSavedSession()).resolves.toBeNull();
  });

  it("goes back to the server step with the address filled in", async () => {
    await renderRouter(appRoutes);

    await enterServer("book.example.com");
    await fireEvent.press(await screen.findByRole("button", { name: keyStrings.changeServer }));

    expect(await screen.findByLabelText(serverStrings.addressLabel)).toHaveDisplayValue("book.example.com");
  });

  it("signs out from Settings and returns to sign-in", async () => {
    await saveSession({ account: testAccount, apiKey: "cal_secret" });
    await renderRouter(appRoutes, { initialUrl: "/settings" });

    await fireEvent.press(await screen.findByRole("button", { name: en.settings.signOut }));

    expect(await screen.findByRole("header", { name: serverStrings.title })).toBeOnTheScreen();
    await expect(loadSavedSession()).resolves.toBeNull();
  });

  it("stays signed in and says so when the key can't be removed", async () => {
    await saveSession({ account: testAccount, apiKey: "cal_secret" });
    mockFailDeletes = true;
    await renderRouter(appRoutes, { initialUrl: "/settings" });

    await fireEvent.press(await screen.findByRole("button", { name: en.settings.signOut }));

    expect(screen.getByRole("alert")).toHaveTextContent(en.settings.signOutFailed);
    expect(screen).toHavePathname("/settings");
  });
});
