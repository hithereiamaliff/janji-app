import { env, exports } from "cloudflare:workers";
import type { RegisterDeviceResponse } from "@janji/shared/relay";
import { describe, expect, it } from "vitest";

let tokens = 0;
const newPushToken = () => `ExponentPushToken[update-${++tokens}]`;

async function registered(): Promise<RegisterDeviceResponse> {
  const response = await exports.default.fetch("https://relay.test/v1/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9" },
    body: JSON.stringify({ expoPushToken: newPushToken(), platform: "android", locale: "en" }),
  });
  return response.json<RegisterDeviceResponse>();
}

function call(method: string, path: string, { token, body }: { token?: string; body?: unknown } = {}) {
  return exports.default.fetch(`https://relay.test${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function storedDevice(id: string) {
  return env.DB.prepare("SELECT push_token, locale FROM devices WHERE id = ?")
    .bind(id)
    .first<{ push_token: string; locale: string }>();
}

describe("changing a device", () => {
  it("takes a new push token and locale from the device's own token", async () => {
    const device = await registered();
    const expoPushToken = newPushToken();

    const response = await call("PATCH", `/v1/devices/${device.deviceId}`, {
      token: device.deviceToken,
      body: { expoPushToken, locale: "ms-MY" },
    });

    expect(response.status).toBe(204);
    expect(await storedDevice(device.deviceId)).toEqual({ push_token: expoPushToken, locale: "ms-MY" });
  });

  it("keeps what isn't given", async () => {
    const device = await registered();
    const before = await storedDevice(device.deviceId);

    await call("PATCH", `/v1/devices/${device.deviceId}`, {
      token: device.deviceToken,
      body: { locale: "en-GB" },
    });

    expect(await storedDevice(device.deviceId)).toEqual({ push_token: before?.push_token, locale: "en-GB" });
  });

  it("refuses another device's token, no token, and a device it doesn't have", async () => {
    const device = await registered();
    const other = await registered();
    const body = { locale: "ms" };

    expect(
      (await call("PATCH", `/v1/devices/${device.deviceId}`, { token: other.deviceToken, body })).status
    ).toBe(401);
    expect((await call("PATCH", `/v1/devices/${device.deviceId}`, { body })).status).toBe(401);
    const missing = await call("PATCH", "/v1/devices/aaaaaaaaaaaaaaaaaaaaaa", {
      token: device.deviceToken,
      body,
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "not_found" });
    expect((await storedDevice(device.deviceId))?.locale).toBe("en");
  });

  it.each([
    ["nothing to change", {}],
    ["a push token Expo doesn't make", { expoPushToken: "abc" }],
    ["a locale that isn't one", { locale: "<b>" }],
  ])("refuses %s", async (_, body) => {
    const device = await registered();

    const response = await call("PATCH", `/v1/devices/${device.deviceId}`, {
      token: device.deviceToken,
      body,
    });

    expect(response.status).toBe(400);
  });

  it("won't take a push token another device has", async () => {
    const device = await registered();
    const other = await registered();
    const otherToken = (await storedDevice(other.deviceId))?.push_token;

    const response = await call("PATCH", `/v1/devices/${device.deviceId}`, {
      token: device.deviceToken,
      body: { expoPushToken: otherToken },
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "push_token_taken" });
  });
});

describe("removing a device", () => {
  it("deletes it with its own token, after which it's gone", async () => {
    const device = await registered();

    expect((await call("DELETE", `/v1/devices/${device.deviceId}`, { token: "wrong" })).status).toBe(401);
    expect(
      (await call("DELETE", `/v1/devices/${device.deviceId}`, { token: device.deviceToken })).status
    ).toBe(204);

    expect(await storedDevice(device.deviceId)).toBeNull();
    expect(
      (await call("DELETE", `/v1/devices/${device.deviceId}`, { token: device.deviceToken })).status
    ).toBe(404);
  });
});

describe("checking devices", () => {
  it("says which of the devices it still has, in the order asked", async () => {
    const kept = await registered();
    const removed = await registered();
    await call("DELETE", `/v1/devices/${removed.deviceId}`, { token: removed.deviceToken });

    const response = await call("POST", "/v1/devices/status", {
      body: { deviceIds: [removed.deviceId, kept.deviceId, "bbbbbbbbbbbbbbbbbbbbbb"] },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ known: [kept.deviceId] });
  });

  it.each([
    ["no list", {}],
    ["an empty list", { deviceIds: [] }],
    ["something that isn't a device ID", { deviceIds: ["../../etc"] }],
    ["more than 100", { deviceIds: Array.from({ length: 101 }, () => "cccccccccccccccccccccc") }],
  ])("refuses %s", async (_, body) => {
    expect((await call("POST", "/v1/devices/status", { body })).status).toBe(400);
  });
});
