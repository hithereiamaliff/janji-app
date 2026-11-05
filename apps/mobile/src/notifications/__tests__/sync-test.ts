import { createCalClient } from "@janji/cal-api/client";

import { syncNotifications } from "@/notifications/notifications";
import { loadPushRegistration, type PushRegistration } from "@/notifications/registration-storage";
import { createRelayClient } from "@/notifications/relay-client";
import { jsonResponse, testAccount } from "@/test-utils/fixtures";

const mockStore = new Map<string, string>();
let mockGranted: boolean;

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
  getPermissionsAsync: async () => ({ granted: mockGranted, canAskAgain: false }),
  getExpoPushTokenAsync: async () => ({ type: "expo", data: "ExponentPushToken[new]" }),
}));

const relayOrigin = "https://relay.example";
const setup = { platform: "ios", relayOrigin, projectId: "project-1" } as const;
const phone = "AAAAAAAAAAAAAAAAAAAAAA";
const otherPhone = "BBBBBBBBBBBBBBBBBBBBBB";
const hook = (deviceId: string) => `${relayOrigin}/v1/hooks/${deviceId}`;
const registration: PushRegistration = {
  serverOrigin: testAccount.serverOrigin,
  userId: testAccount.user.id,
  relayOrigin,
  deviceId: phone,
  deviceToken: "token-a",
  webhookId: 12,
  expoPushToken: "ExponentPushToken[new]",
  locale: "en-MY",
};

type Device = { token: string; pushToken: string };

/** Cal.diy's webhooks and the relay's devices, answering as they would; `sent` lists the changes only. */
function world({
  webhooks = [] as { id: number; subscriberUrl: string }[],
  devices = new Map<string, Device>(),
}) {
  const sent: string[] = [];
  let nextId = 100;
  const relay = createRelayClient(relayOrigin, async (request) => {
    const path = new URL(request.url).pathname;
    const body = request.method === "DELETE" ? null : await request.json();
    if (path === "/v1/devices/status") {
      return jsonResponse({ known: body.deviceIds.filter((id: string) => devices.has(id)) });
    }
    sent.push(`relay ${request.method} ${path}`);
    if (request.method === "POST") {
      const held = [...devices].find(([, device]) => device.pushToken === body.expoPushToken)?.[0];
      const deviceId = held ?? "CCCCCCCCCCCCCCCCCCCCCC";
      const token = `token-${nextId++}`;
      devices.set(deviceId, { token, pushToken: body.expoPushToken });
      return jsonResponse({ deviceId, deviceToken: token, hookUrl: hook(deviceId), webhookSecret: "s" });
    }
    const deviceId = path.split("/").at(-1) ?? "";
    const device = devices.get(deviceId);
    if (!device) return jsonResponse({ error: "not_found" }, { status: 404 });
    if (request.method === "DELETE") devices.delete(deviceId);
    else if (
      [...devices.values()].some((other) => other !== device && other.pushToken === body.expoPushToken)
    ) {
      return jsonResponse({ error: "push_token_taken" }, { status: 409 });
    } else device.pushToken = body.expoPushToken;
    return new Response(null, { status: 204 });
  });
  const calClient = createCalClient({
    apiRootUrl: "https://book.example.com/api",
    getApiKey: () => "cal_secret",
    fetch: async (request) => {
      const path = new URL(request.url).pathname.replace("/api", "");
      if (request.method === "GET") return jsonResponse({ status: "success", data: webhooks });
      sent.push(`cal ${request.method} ${path}`);
      if (request.method === "DELETE") {
        const id = Number(path.split("/").at(-1));
        if (!webhooks.some((webhook) => webhook.id === id))
          return jsonResponse({ status: "error" }, { status: 404 });
        webhooks = webhooks.filter((webhook) => webhook.id !== id);
        return jsonResponse({ status: "success" });
      }
      const { subscriberUrl } = await request.json();
      const webhook = { id: nextId++, subscriberUrl };
      webhooks = [...webhooks, webhook];
      return jsonResponse({ status: "success", data: webhook }, { status: 201 });
    },
  });
  const sync = (locale = "en-MY") =>
    syncNotifications({ calClient, setup, account: testAccount, locale, relayFor: () => relay });
  return { sync, sent, devices, webhooks: () => webhooks };
}

/** This phone, connected: its device at the relay and its webhook at Cal.diy. */
const connected = () => ({
  webhooks: [{ id: 12, subscriberUrl: hook(phone) }],
  devices: new Map([[phone, { token: "token-a", pushToken: "ExponentPushToken[new]" }]]),
});

describe("syncNotifications", () => {
  beforeEach(() => {
    mockStore.clear();
    mockGranted = true;
  });

  it("does nothing more than look when the phone is connected and unchanged", async () => {
    mockStore.set("janji.notifications", JSON.stringify(registration));
    const { sync, sent } = world(connected());

    await sync();

    expect(sent).toEqual([]);
    await expect(loadPushRegistration()).resolves.toEqual(registration);
  });

  it("removes the device another account left when signing out couldn't reach the relay", async () => {
    mockStore.set("janji.notifications", JSON.stringify({ ...registration, userId: 8 }));
    // That account's webhook isn't among this account's.
    const { sync, sent, devices } = world({ ...connected(), webhooks: [] });

    await sync();

    expect(sent).toEqual([`relay DELETE /v1/devices/${phone}`]);
    expect(devices.size).toBe(0);
    await expect(loadPushRegistration()).resolves.toBeNull();
  });

  it("deletes the account's webhooks for phones the relay no longer knows", async () => {
    const devices = new Map([[otherPhone, { token: "token-b", pushToken: "ExponentPushToken[b]" }]]);
    const webhooks = [
      { id: 13, subscriberUrl: hook(otherPhone) },
      { id: 14, subscriberUrl: hook("DDDDDDDDDDDDDDDDDDDDDD") },
      { id: 15, subscriberUrl: `${hook("not-a-device")}?x=1` },
    ];
    const { sync, sent, webhooks: left } = world({ webhooks, devices });

    await sync();

    expect(sent).toEqual(["cal DELETE /v2/webhooks/14", "cal DELETE /v2/webhooks/15"]);
    expect(left()).toEqual([{ id: 13, subscriberUrl: hook(otherPhone) }]);
  });

  it("gives the relay the phone's new push token and language", async () => {
    mockStore.set(
      "janji.notifications",
      JSON.stringify({ ...registration, expoPushToken: "ExponentPushToken[old]" })
    );
    const { sync, sent } = world(connected());

    await sync("ms-MY");

    expect(sent).toEqual([`relay PATCH /v1/devices/${phone}`]);
    await expect(loadPushRegistration()).resolves.toEqual({ ...registration, locale: "ms-MY" });
  });

  it("connects a new webhook when the old one was deleted on the web", async () => {
    mockStore.set("janji.notifications", JSON.stringify(registration));
    const { sync, sent, webhooks } = world({ ...connected(), webhooks: [] });

    await sync();

    expect(sent).toEqual(["relay POST /v1/devices", "cal POST /v2/webhooks", "cal DELETE /v2/webhooks/12"]);
    expect(webhooks()).toEqual([{ id: 101, subscriberUrl: hook(phone) }]);
    await expect(loadPushRegistration()).resolves.toEqual({
      ...registration,
      deviceToken: "token-100",
      webhookId: 101,
    });
  });

  it("registers again when the relay forgot the phone, replacing its webhook", async () => {
    mockStore.set("janji.notifications", JSON.stringify(registration));
    const { sync, sent, webhooks } = world({ ...connected(), devices: new Map() });

    await sync();

    const moved = "CCCCCCCCCCCCCCCCCCCCCC";
    expect(sent).toEqual([
      "cal DELETE /v2/webhooks/12",
      "relay POST /v1/devices",
      "cal POST /v2/webhooks",
      `relay DELETE /v1/devices/${phone}`,
      "cal DELETE /v2/webhooks/12",
    ]);
    expect(webhooks()).toEqual([{ id: 101, subscriberUrl: hook(moved) }]);
    await expect(loadPushRegistration()).resolves.toMatchObject({ deviceId: moved, webhookId: 101 });
  });

  it("registers again when another device already has the new push token", async () => {
    mockStore.set(
      "janji.notifications",
      JSON.stringify({ ...registration, expoPushToken: "ExponentPushToken[old]" })
    );
    const devices = new Map([
      [phone, { token: "token-a", pushToken: "ExponentPushToken[old]" }],
      [otherPhone, { token: "token-b", pushToken: "ExponentPushToken[new]" }],
    ]);
    const { sync, sent } = world({ webhooks: [{ id: 12, subscriberUrl: hook(phone) }], devices });

    await sync();

    expect(sent).toEqual([
      `relay PATCH /v1/devices/${phone}`,
      "relay POST /v1/devices",
      "cal POST /v2/webhooks",
      `relay DELETE /v1/devices/${phone}`,
      "cal DELETE /v2/webhooks/12",
    ]);
    expect([...devices.keys()]).toEqual([otherPhone]);
    await expect(loadPushRegistration()).resolves.toMatchObject({
      deviceId: otherPhone,
      deviceToken: "token-100",
    });
  });

  it("leaves the registration alone while the phone doesn't allow notifications", async () => {
    mockGranted = false;
    mockStore.set(
      "janji.notifications",
      JSON.stringify({ ...registration, expoPushToken: "ExponentPushToken[old]" })
    );
    const { sync, sent } = world(connected());

    await sync();

    expect(sent).toEqual([]);
  });
});
