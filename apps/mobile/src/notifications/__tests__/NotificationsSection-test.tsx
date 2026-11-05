import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Linking } from "react-native";

import en from "@/i18n/locales/en.json";
import type { PushSetup } from "@/notifications/push-setup";
import type { PushRegistration } from "@/notifications/registration-storage";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import { jsonResponse, testAccount, testMeResponse } from "@/test-utils/fixtures";

type MockPermission = { granted: boolean; canAskAgain: boolean };

const mockStore = new Map<string, string>();
let mockSetup: PushSetup | null;
let mockPermission: MockPermission;
let mockAnswer: MockPermission;

jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));

jest.mock("expo-notifications", () => ({
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1 },
  getPermissionsAsync: async () => mockPermission,
  requestPermissionsAsync: async () => {
    mockPermission = mockAnswer;
    return mockAnswer;
  },
  getExpoPushTokenAsync: async () => ({ type: "expo", data: "ExponentPushToken[abc]" }),
}));

jest.mock("@/notifications/push-setup", () => ({ pushSetup: () => mockSetup }));

const granted: MockPermission = { granted: true, canAskAgain: false };
const notAsked: MockPermission = { granted: false, canAskAgain: true };
const blocked: MockPermission = { granted: false, canAskAgain: false };
const hookUrl = "https://relay.example/v1/hooks/AAAAAAAAAAAAAAAAAAAAAA";
const registration: PushRegistration = {
  serverOrigin: testAccount.serverOrigin,
  userId: testAccount.user.id,
  relayOrigin: "https://relay.example",
  deviceId: "AAAAAAAAAAAAAAAAAAAAAA",
  deviceToken: "device-secret",
  webhookId: 12,
  expoPushToken: "ExponentPushToken[abc]",
  locale: "en-US",
};

/** Opens Settings, with Cal.diy and the relay answering as they would unless the relay is `unreachable`. */
async function openSettings({ unreachable = false } = {}) {
  const sent: string[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const { origin, pathname } = new URL(request.url);
    if (pathname.endsWith("/v2/me")) return jsonResponse(testMeResponse);
    sent.push(`${request.method} ${origin}${pathname}`);
    if (origin === "https://relay.example") {
      if (unreachable) throw new TypeError("Network request failed");
      if (request.method === "DELETE") return new Response(null, { status: 204 });
      const device = {
        deviceId: registration.deviceId,
        deviceToken: "device-secret",
        hookUrl,
        webhookSecret: "s",
      };
      return jsonResponse(device, { status: 201 });
    }
    if (request.method === "DELETE") return jsonResponse({ status: "success" });
    return jsonResponse({ status: "success", data: { id: 12, subscriberUrl: hookUrl } }, { status: 201 });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: "/settings" });
  return sent;
}

const notificationsSwitch = () => screen.findByRole("switch", { name: en.notifications.label });

async function turn(on: boolean) {
  await fireEvent(await notificationsSwitch(), "valueChange", on);
}

describe("booking notifications in Settings", () => {
  beforeEach(() => {
    mockStore.clear();
    mockSetup = { platform: "ios", relayOrigin: "https://relay.example", projectId: "project-1" };
    mockPermission = notAsked;
    mockAnswer = granted;
  });
  afterEach(() => jest.restoreAllMocks());

  it("turns them on for this phone once it allows them", async () => {
    const sent = await openSettings();
    expect(await notificationsSwitch()).not.toBeChecked();

    await turn(true);

    await waitFor(async () => expect(await notificationsSwitch()).toBeChecked());
    expect(sent).toEqual([
      "POST https://relay.example/v1/devices",
      "POST https://book.example.com/api/v2/webhooks",
    ]);
    expect(JSON.parse(mockStore.get("janji.notifications") ?? "null")).toEqual(registration);
  });

  it("turns them off again", async () => {
    mockStore.set("janji.notifications", JSON.stringify(registration));
    mockPermission = granted;
    const sent = await openSettings();
    expect(await notificationsSwitch()).toBeChecked();

    await turn(false);

    await waitFor(async () => expect(await notificationsSwitch()).not.toBeChecked());
    expect(sent).toEqual([
      `DELETE https://relay.example/v1/devices/${registration.deviceId}`,
      "DELETE https://book.example.com/api/v2/webhooks/12",
    ]);
    expect(mockStore.has("janji.notifications")).toBe(false);
  });

  it("explains when the phone's settings block them, and opens those settings", async () => {
    mockPermission = blocked;
    const openSettingsApp = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    const sent = await openSettings();

    await turn(true);

    expect(await screen.findByRole("alert")).toHaveTextContent(en.notifications.blocked);
    await fireEvent.press(screen.getByRole("button", { name: en.notifications.openSettings }));
    expect(openSettingsApp).toHaveBeenCalled();
    expect(sent).toEqual([]);
    expect(await notificationsSwitch()).not.toBeChecked();
  });

  it("asks to choose Allow when the person didn't", async () => {
    mockAnswer = notAsked;
    await openSettings();

    await turn(true);

    expect(await screen.findByRole("alert")).toHaveTextContent(en.notifications.notAllowed);
  });

  it("says when the relay can't be reached, and stays off", async () => {
    mockPermission = granted;
    await openSettings({ unreachable: true });

    await turn(true);

    expect(await screen.findByRole("alert")).toHaveTextContent(en.notifications.relayUnreachable);
    expect(await notificationsSwitch()).not.toBeChecked();
    expect(mockStore.has("janji.notifications")).toBe(false);
  });

  it("points out phone settings that stop notifications that are on", async () => {
    mockStore.set("janji.notifications", JSON.stringify(registration));
    mockPermission = blocked;
    await openSettings();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.notifications.blockedWhileOn);
    expect(screen.getByRole("button", { name: en.notifications.openSettings })).toBeOnTheScreen();
    expect(await notificationsSwitch()).toBeChecked();
  });

  it("asks again when notifications are on but the phone hasn't allowed them, as after a reinstall", async () => {
    mockStore.set("janji.notifications", JSON.stringify(registration));
    const sent = await openSettings();
    expect(await screen.findByRole("alert")).toHaveTextContent(en.notifications.notAllowedWhileOn);

    await fireEvent.press(screen.getByRole("button", { name: en.notifications.allow }));

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(sent).toEqual([
      "POST https://relay.example/v1/devices",
      "POST https://book.example.com/api/v2/webhooks",
    ]);
  });

  it("says when this version of Janji can't send them", async () => {
    mockSetup = null;
    await openSettings();

    expect(await screen.findByText(en.notifications.unavailable)).toBeOnTheScreen();
    expect(screen.queryByRole("switch", { name: en.notifications.label })).toBeNull();
  });
});
