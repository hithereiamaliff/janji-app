import "@/i18n";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { QueryProvider } from "@/data/QueryProvider";
import type { PushRegistration } from "@/notifications/registration-storage";
import {
  useChooseRelay,
  useNotifications,
  useNotificationsSync,
  useTurnOffNotifications,
  useTurnOnNotifications,
} from "@/notifications/useNotifications";
import { saveSession } from "@/session/account-storage";
import { SessionProvider, useSession } from "@/session/SessionProvider";
import { jsonResponse, testAccount } from "@/test-utils/fixtures";

const mockStore = new Map<string, string>();
// The app config's `extra`, as a build has it.
let mockExtra: unknown;
let mockToken = "ExponentPushToken[abc]";
const mockTokenListeners = new Set<() => void>();

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
  getPermissionsAsync: async () => ({ granted: true, canAskAgain: false }),
  getExpoPushTokenAsync: async () => ({ type: "expo", data: mockToken }),
  addPushTokenListener: (listener: () => void) => {
    mockTokenListeners.add(listener);
    return { remove: () => mockTokenListeners.delete(listener) };
  },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra };
    },
    easConfig: null,
  },
}));

const build = { relayOrigin: "https://relay.example", eas: { projectId: "project-1" } };

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

function WhenSignedIn({ children }: { children: ReactNode }) {
  const { session } = useSession();
  return session.status === "signedIn" ? children : <Text>{session.status}</Text>;
}

function NotificationsSwitch() {
  const notifications = useNotifications();
  const turnOn = useTurnOnNotifications();
  const turnOff = useTurnOffNotifications();
  const chooseRelay = useChooseRelay();
  const state = notifications.data;
  if (!state) return <Text>loading</Text>;
  return (
    <>
      <Text>{state.status === "unavailable" ? "unavailable" : `${state.status}, ${state.permission}`}</Text>
      {state.status === "unavailable" ? null : <Text>{`relay ${state.relay.origin}`}</Text>}
      <Pressable accessibilityRole="button" onPress={() => chooseRelay.mutate("https://my-relay.example")}>
        <Text>Use my relay</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => chooseRelay.mutate(null)}>
        <Text>Use the build's relay</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => turnOn.mutate()}>
        <Text>Turn on</Text>
      </Pressable>
      {state.status === "on" ? (
        <Pressable accessibilityRole="button" onPress={() => turnOff.mutate()}>
          <Text>Turn off</Text>
        </Pressable>
      ) : null}
    </>
  );
}

/** Answers Cal.diy's and the relay's requests as they would, noting each one and what registered. */
async function renderSwitch() {
  const sent: string[] = [];
  const registered: unknown[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const { origin, pathname } = new URL(request.url);
    sent.push(`${request.method} ${origin}${pathname}`);
    if (origin.endsWith("relay.example")) {
      if (request.method === "DELETE") return new Response(null, { status: 204 });
      registered.push(await request.json());
      return jsonResponse(
        {
          deviceId: registration.deviceId,
          deviceToken: "device-secret",
          hookUrl,
          webhookSecret: "hook-secret",
        },
        { status: 201 }
      );
    }
    if (request.method === "DELETE") return jsonResponse({ status: "success" });
    return jsonResponse({ status: "success", data: { id: 12, subscriberUrl: hookUrl } }, { status: 201 });
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await render(
    <SessionProvider>
      <QueryProvider>
        <WhenSignedIn>
          <NotificationsSwitch />
        </WhenSignedIn>
      </QueryProvider>
    </SessionProvider>
  );
  return { sent, registered };
}

describe("useNotifications", () => {
  beforeEach(() => {
    mockStore.clear();
    mockExtra = build;
  });
  afterEach(() => jest.restoreAllMocks());

  it("is unavailable in a build without notifications", async () => {
    mockExtra = {};
    await renderSwitch();

    expect(await screen.findByText("unavailable")).toBeOnTheScreen();
  });

  it("turns this phone's notifications on, in its language, then off again", async () => {
    const { sent, registered } = await renderSwitch();
    expect(await screen.findByText("off, granted")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Turn on" }));

    expect(await screen.findByText("on, granted")).toBeOnTheScreen();
    expect(registered).toEqual([
      { expoPushToken: "ExponentPushToken[abc]", platform: "ios", locale: "en-US" },
    ]);
    expect(JSON.parse(mockStore.get("janji.notifications") ?? "null")).toEqual(registration);

    await fireEvent.press(screen.getByRole("button", { name: "Turn off" }));

    expect(await screen.findByText("off, granted")).toBeOnTheScreen();
    expect(mockStore.has("janji.notifications")).toBe(false);
    expect(sent).toEqual([
      "POST https://relay.example/v1/devices",
      "POST https://book.example.com/api/v2/webhooks",
      `DELETE https://relay.example/v1/devices/${registration.deviceId}`,
      "DELETE https://book.example.com/api/v2/webhooks/12",
    ]);
  });

  it("goes through the relay chosen under Advanced, until it's set back to the build's", async () => {
    const { sent } = await renderSwitch();
    expect(await screen.findByText("relay https://relay.example")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Use my relay" }));
    expect(await screen.findByText("relay https://my-relay.example")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Turn on" }));
    expect(await screen.findByText("on, granted")).toBeOnTheScreen();
    expect(sent[0]).toBe("POST https://my-relay.example/v1/devices");

    await fireEvent.press(screen.getByRole("button", { name: "Use the build's relay" }));
    expect(await screen.findByText("relay https://relay.example")).toBeOnTheScreen();
  });

  it("has no relay in a build made without one, until one is chosen", async () => {
    mockExtra = { eas: { projectId: "project-1" } };
    await renderSwitch();

    expect(await screen.findByText("relay null")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Use my relay" }));
    expect(await screen.findByText("relay https://my-relay.example")).toBeOnTheScreen();
  });

  it("doesn't count notifications another account turned on as this one's", async () => {
    mockStore.set("janji.notifications", JSON.stringify({ ...registration, userId: 8 }));
    await renderSwitch();

    expect(await screen.findByText("off, granted")).toBeOnTheScreen();
  });
});

function Sync() {
  useNotificationsSync();
  return <Text>synced</Text>;
}

describe("useNotificationsSync", () => {
  beforeEach(() => {
    mockStore.clear();
    mockExtra = build;
    mockToken = "ExponentPushToken[abc]";
  });
  afterEach(() => jest.restoreAllMocks());

  it("passes the phone's push token on as the app starts, and again when it changes", async () => {
    const tokens: unknown[] = [];
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const request = input instanceof Request ? input : new Request(String(input));
      const { pathname } = new URL(request.url);
      if (pathname === "/v1/devices/status") return jsonResponse({ known: [registration.deviceId] });
      if (request.method === "PATCH") {
        tokens.push((await request.json()).expoPushToken);
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ status: "success", data: [{ id: 12, subscriberUrl: hookUrl }] });
    });
    mockStore.set(
      "janji.notifications",
      JSON.stringify({ ...registration, expoPushToken: "ExponentPushToken[old]" })
    );
    mockToken = "ExponentPushToken[new]";
    await saveSession({ account: testAccount, apiKey: "cal_secret" });
    await render(
      <SessionProvider>
        <QueryProvider>
          <WhenSignedIn>
            <Sync />
          </WhenSignedIn>
        </QueryProvider>
      </SessionProvider>
    );

    await waitFor(() => expect(tokens).toEqual(["ExponentPushToken[new]"]));
    mockToken = "ExponentPushToken[newer]";
    await act(async () => {
      for (const listener of mockTokenListeners) listener();
    });

    await waitFor(() => expect(tokens).toEqual(["ExponentPushToken[new]", "ExponentPushToken[newer]"]));
    expect(JSON.parse(mockStore.get("janji.notifications") ?? "null")).toMatchObject({
      expoPushToken: "ExponentPushToken[newer]",
    });
  });
});
