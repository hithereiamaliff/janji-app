import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";

import en from "@/i18n/locales/en.json";
import { loadWelcomeSeen, saveWelcomeSeen } from "@/onboarding/welcome-storage";
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
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "opened" })) }));
jest.mock("expo-clipboard", () => ({ getStringAsync: jest.fn(async () => "") }));

const { server: serverStrings, apiKey: keyStrings } = en.signIn;
const welcomeStrings = en.welcome;

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

describe("the welcome", () => {
  beforeEach(() => {
    mockStore.clear();
    mockFailDeletes = false;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => fakeServer(input));
  });

  afterEach(() => jest.restoreAllMocks());

  it("greets a new phone once, then leads to the server step", async () => {
    await renderRouter(appRoutes);

    expect(await screen.findByRole("header", { name: welcomeStrings.title })).toBeOnTheScreen();
    expect(screen).toHavePathname("/sign-in");
    await fireEvent.press(screen.getByRole("button", { name: welcomeStrings.getStarted }));

    expect(await screen.findByRole("header", { name: serverStrings.title })).toBeOnTheScreen();
    await expect(loadWelcomeSeen()).resolves.toBe(true);
  });

  it("opens again from the server step and keeps the address typed so far", async () => {
    await saveWelcomeSeen();
    await renderRouter(appRoutes);

    await fireEvent.changeText(await screen.findByLabelText(serverStrings.addressLabel), "book.example.com");
    await fireEvent.press(screen.getByRole("button", { name: serverStrings.aboutJanji }));
    expect(await screen.findByRole("header", { name: welcomeStrings.title })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: welcomeStrings.getStarted }));

    expect(await screen.findByLabelText(serverStrings.addressLabel)).toHaveDisplayValue("book.example.com");
  });
});

describe("without a Cal.diy server", () => {
  beforeEach(() => {
    mockStore.clear();
    mockFailDeletes = false;
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => fakeServer(input));
  });

  afterEach(() => jest.restoreAllMocks());

  it("explains what to do instead, then returns to the server step", async () => {
    await saveWelcomeSeen();
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await renderRouter(appRoutes);

    await fireEvent.changeText(await screen.findByLabelText(serverStrings.addressLabel), "book.example");
    await fireEvent.press(screen.getByRole("button", { name: en.noServer.link }));
    expect(await screen.findByRole("header", { name: en.noServer.title })).toBeOnTheScreen();
    expect(screen).toHavePathname("/no-server");

    await fireEvent.press(screen.getByRole("button", { name: en.noServer.calCom.action }));
    expect(openURL).toHaveBeenCalledWith("https://apps.apple.com/app/id6757157271");
    await fireEvent.press(screen.getByRole("button", { name: en.noServer.ownServer.action }));
    expect(await screen.findByRole("header", { name: en.serverGuide.title })).toBeOnTheScreen();
    expect(screen).toHavePathname("/server-guide");
    await fireEvent.press(screen.getByRole("button", { name: en.serverGuide.install.action }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith("https://github.com/calcom/cal.diy#deployment");
    await fireEvent.press(screen.getByRole("button", { name: en.serverGuide.apiV2.action }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      "https://github.com/hithereiamaliff/janji-app/blob/main/docs/server-setup.md"
    );

    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.goBack }));
    expect(screen).toHavePathname("/no-server");
    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.goBack }));
    expect(screen).toHavePathname("/sign-in");
    expect(await screen.findByLabelText(serverStrings.addressLabel)).toHaveDisplayValue("book.example");
  });

  it("opens from the welcome and goes back to it", async () => {
    await renderRouter(appRoutes);

    await fireEvent.press(await screen.findByRole("button", { name: en.noServer.link }));
    expect(await screen.findByRole("header", { name: en.noServer.title })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: en.bookingActions.goBack }));

    expect(screen).toHavePathname("/sign-in");
    expect(await screen.findByRole("header", { name: welcomeStrings.title })).toBeOnTheScreen();
  });
});

describe("signing in and out", () => {
  beforeEach(async () => {
    mockStore.clear();
    mockFailDeletes = false;
    await saveWelcomeSeen();
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => fakeServer(input));
  });

  afterEach(() => jest.restoreAllMocks());

  it("starts on the server step when no account is saved and the welcome was seen", async () => {
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
