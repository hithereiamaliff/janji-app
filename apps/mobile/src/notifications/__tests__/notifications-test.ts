import { createCalClient } from "@janji/cal-api/client";

import {
  belongsTo,
  chooseNotificationEvents,
  releaseNotifications,
  turnOffNotifications,
  turnOnNotifications,
} from "@/notifications/notifications";
import { loadPushRegistration, type PushRegistration } from "@/notifications/registration-storage";
import { createRelayClient, RelayRequestError } from "@/notifications/relay-client";
import { HOOK_TRIGGERS } from "@/notifications/webhooks-api";
import { jsonResponse, testAccount } from "@/test-utils/fixtures";

const mockStore = new Map<string, string>();
let mockPermission: { granted: boolean; canAskAgain: boolean };

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
  AndroidImportance: { HIGH: 6 },
  getPermissionsAsync: async () => mockPermission,
  requestPermissionsAsync: async () => mockPermission,
  setNotificationChannelAsync: async () => null,
  getExpoPushTokenAsync: async () => ({ type: "expo", data: "ExponentPushToken[abc]" }),
}));

type Sent = { to: "cal" | "relay"; method: string; path: string; token: string | null; body: unknown };

const setup = { platform: "ios", relayOrigin: "https://relay.example", projectId: "project-1" } as const;
const hookUrl = "https://relay.example/v1/hooks/AAAAAAAAAAAAAAAAAAAAAA";
const registration: PushRegistration = {
  serverOrigin: testAccount.serverOrigin,
  userId: testAccount.user.id,
  relayOrigin: setup.relayOrigin,
  deviceId: "AAAAAAAAAAAAAAAAAAAAAA",
  deviceToken: "device-secret",
  webhookId: 12,
  expoPushToken: "ExponentPushToken[abc]",
  locale: "en-MY",
};

/** Cal.diy and the relay, answering with `answer` or as they would, and noting what they were sent. */
function servers(answer: (to: Sent["to"], request: Request) => Response | null = () => null) {
  const sent: Sent[] = [];
  const record = (to: Sent["to"]) => async (request: Request) => {
    const text = await request.clone().text();
    sent.push({
      to,
      method: request.method,
      path: new URL(request.url).pathname,
      token: request.headers.get("Authorization"),
      body: text ? JSON.parse(text) : null,
    });
    const answered = answer(to, request);
    if (answered) return answered;
    if (to === "relay" && request.method === "POST") {
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
    if (request.method === "DELETE") return new Response(null, { status: to === "relay" ? 204 : 200 });
    return jsonResponse({ status: "success", data: { id: 12, subscriberUrl: hookUrl } }, { status: 201 });
  };
  const calClient = createCalClient({
    apiRootUrl: "https://book.example.com/api",
    getApiKey: () => "cal_secret",
    fetch: record("cal"),
  });
  return { calClient, relay: createRelayClient(setup.relayOrigin, record("relay")), sent };
}

const turnOn = (
  calClient: ReturnType<typeof servers>["calClient"],
  relay: ReturnType<typeof servers>["relay"]
) =>
  turnOnNotifications({
    calClient,
    relay,
    setup,
    account: testAccount,
    locale: "en-MY",
    channelName: "Bookings",
  });

beforeEach(() => {
  mockStore.clear();
  mockPermission = { granted: true, canAskAgain: false };
});

describe("turnOnNotifications", () => {
  it("registers the phone with the relay, points a webhook at it and keeps both", async () => {
    const { calClient, relay, sent } = servers();

    await expect(turnOn(calClient, relay)).resolves.toEqual({ status: "on", registration });

    expect(sent).toEqual([
      {
        to: "relay",
        method: "POST",
        path: "/v1/devices",
        token: null,
        body: { expoPushToken: "ExponentPushToken[abc]", platform: "ios", locale: "en-MY" },
      },
      {
        to: "cal",
        method: "POST",
        path: "/api/v2/webhooks",
        token: "Bearer cal_secret",
        body: { subscriberUrl: hookUrl, secret: "hook-secret", active: true, triggers: [...HOOK_TRIGGERS] },
      },
    ]);
    await expect(loadPushRegistration()).resolves.toEqual(registration);
  });

  it.each([
    ["only the phone's settings can allow them", false, "blocked"],
    ["the person didn't allow them", true, "canAsk"],
  ] as const)("registers nothing when %s", async (_, canAskAgain, permission) => {
    mockPermission = { granted: false, canAskAgain };
    const { calClient, relay, sent } = servers();

    await expect(turnOn(calClient, relay)).resolves.toEqual({ status: "notAllowed", permission });

    expect(sent).toEqual([]);
    expect(mockStore.size).toBe(0);
  });

  it("removes the relay device again when Cal.diy doesn't take the webhook", async () => {
    const { calClient, relay, sent } = servers((to) =>
      to === "cal" ? jsonResponse({ status: "error" }, { status: 500 }) : null
    );

    await expect(turnOn(calClient, relay)).rejects.toMatchObject({ kind: "server_error" });

    expect(sent.at(-1)).toMatchObject({
      to: "relay",
      method: "DELETE",
      path: `/v1/devices/${registration.deviceId}`,
      token: "Bearer device-secret",
    });
    expect(mockStore.size).toBe(0);
  });
});

describe("turnOffNotifications", () => {
  it("has the relay forget the phone, then deletes its webhook and the registration", async () => {
    const { calClient, relay, sent } = servers();
    mockStore.set("janji.notifications", JSON.stringify(registration));

    await turnOffNotifications({ calClient, relayFor: () => relay });

    expect(sent.map(({ to, method, path, token }) => ({ to, method, path, token }))).toEqual([
      {
        to: "relay",
        method: "DELETE",
        path: `/v1/devices/${registration.deviceId}`,
        token: "Bearer device-secret",
      },
      { to: "cal", method: "DELETE", path: "/api/v2/webhooks/12", token: "Bearer cal_secret" },
    ]);
    expect(mockStore.size).toBe(0);
  });

  it("is off even when the webhook can't be deleted, since the relay no longer sends anything", async () => {
    const { calClient, relay } = servers((to) =>
      to === "cal" ? jsonResponse({ status: "error" }, { status: 500 }) : null
    );
    mockStore.set("janji.notifications", JSON.stringify(registration));

    await turnOffNotifications({ calClient, relayFor: () => relay });

    expect(mockStore.size).toBe(0);
  });

  it("stays on when the relay can't be reached", async () => {
    const { calClient, sent } = servers();
    const unreachable = createRelayClient(setup.relayOrigin, async () => {
      throw new TypeError("Network request failed");
    });
    mockStore.set("janji.notifications", JSON.stringify(registration));

    await expect(turnOffNotifications({ calClient, relayFor: () => unreachable })).rejects.toBeInstanceOf(
      RelayRequestError
    );

    expect(sent).toEqual([]);
    await expect(loadPushRegistration()).resolves.toEqual(registration);
  });
});

describe("releaseNotifications", () => {
  it("removes the phone's device and webhook as the person signs out", async () => {
    const { calClient, relay, sent } = servers();
    mockStore.set("janji.notifications", JSON.stringify(registration));

    await releaseNotifications(calClient, () => relay);

    expect(sent.map(({ to, method, path }) => `${to} ${method} ${path}`)).toEqual([
      `relay DELETE /v1/devices/${registration.deviceId}`,
      "cal DELETE /api/v2/webhooks/12",
    ]);
    expect(mockStore.size).toBe(0);
  });

  it("keeps the registration when the relay can't be reached, so the device can be removed later", async () => {
    const { calClient, sent } = servers();
    const unreachable = createRelayClient(setup.relayOrigin, async () => {
      throw new TypeError("Network request failed");
    });
    mockStore.set("janji.notifications", JSON.stringify(registration));

    await releaseNotifications(calClient, () => unreachable);

    expect(sent.map(({ to, method, path }) => `${to} ${method} ${path}`)).toEqual([
      "cal DELETE /api/v2/webhooks/12",
    ]);
    await expect(loadPushRegistration()).resolves.toEqual(registration);
  });

  it("has nothing to do when notifications are off", async () => {
    const { calClient, relay, sent } = servers();

    await releaseNotifications(calClient, () => relay);

    expect(sent).toEqual([]);
  });
});

describe("chooseNotificationEvents", () => {
  it("changes the webhook's events and keeps the choice", async () => {
    const { calClient, sent } = servers();
    mockStore.set("janji.notifications", JSON.stringify(registration));

    await chooseNotificationEvents(calClient, ["BOOKING_REQUESTED", "BOOKING_CANCELLED"]);

    expect(sent).toEqual([
      {
        to: "cal",
        method: "PATCH",
        path: "/api/v2/webhooks/12",
        token: "Bearer cal_secret",
        body: { triggers: ["BOOKING_REQUESTED", "BOOKING_CANCELLED"] },
      },
    ]);
    await expect(loadPushRegistration()).resolves.toEqual({
      ...registration,
      triggers: ["BOOKING_REQUESTED", "BOOKING_CANCELLED"],
    });
  });
});

describe("belongsTo", () => {
  it("knows the account that turned notifications on from another one", () => {
    expect(belongsTo(registration, testAccount)).toBe(true);
    expect(belongsTo(registration, { ...testAccount, user: { ...testAccount.user, id: 8 } })).toBe(false);
    expect(belongsTo(registration, { ...testAccount, serverOrigin: "https://cal.example.org" })).toBe(false);
  });
});
