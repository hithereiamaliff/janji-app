import "@/i18n";

import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { QueryProvider } from "@/data/QueryProvider";
import type { PushSetup } from "@/notifications/push-setup";
import type { PushRegistration } from "@/notifications/registration-storage";
import {
  useNotifications,
  useTurnOffNotifications,
  useTurnOnNotifications,
} from "@/notifications/useNotifications";
import { saveSession } from "@/session/account-storage";
import { SessionProvider, useSession } from "@/session/SessionProvider";
import { jsonResponse, testAccount } from "@/test-utils/fixtures";

const mockStore = new Map<string, string>();
let mockSetup: PushSetup | null;

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
  getExpoPushTokenAsync: async () => ({ type: "expo", data: "ExponentPushToken[abc]" }),
}));

jest.mock("@/notifications/push-setup", () => ({ pushSetup: () => mockSetup }));

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
  const state = notifications.data;
  if (!state) return <Text>loading</Text>;
  return (
    <>
      <Text>{state.status === "unavailable" ? "unavailable" : `${state.status}, ${state.permission}`}</Text>
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
    if (origin === "https://relay.example") {
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
    mockSetup = { platform: "ios", relayOrigin: "https://relay.example", projectId: "project-1" };
  });
  afterEach(() => jest.restoreAllMocks());

  it("is unavailable in a build without notifications", async () => {
    mockSetup = null;
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

  it("doesn't count notifications another account turned on as this one's", async () => {
    mockStore.set("janji.notifications", JSON.stringify({ ...registration, userId: 8 }));
    await renderSwitch();

    expect(await screen.findByText("off, granted")).toBeOnTheScreen();
  });
});
