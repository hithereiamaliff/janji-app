import { env, exports } from "cloudflare:workers";
import type { RegisterDeviceResponse } from "@janji/shared/relay";
import { describe, expect, it } from "vitest";

import { decryptSecret, sha256 } from "../src/crypto";

// Tests in a file share one database, so each takes push tokens of its own.
let tokens = 0;
const newPushToken = () => `ExponentPushToken[test-${++tokens}]`;
const pushToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

function register(body: unknown, ip = "203.0.113.1") {
  return exports.default.fetch("https://relay.test/v1/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

type DeviceRow = { id: string; platform: string; locale: string; token_hash: string; webhook_secret: string };

function storedDevice(id: string) {
  return env.DB.prepare("SELECT id, platform, locale, token_hash, webhook_secret FROM devices WHERE id = ?")
    .bind(id)
    .first<DeviceRow>();
}

describe("registering a device", () => {
  it("gives the phone a hook URL and credentials, keeping only a hash and a sealed secret", async () => {
    const response = await register({ expoPushToken: pushToken, platform: "ios", locale: "en-MY" });

    expect(response.status).toBe(201);
    const device = await response.json<RegisterDeviceResponse>();
    expect(device.deviceId).toMatch(/^[\w-]{22}$/);
    expect(device.hookUrl).toBe(`https://relay.test/v1/hooks/${device.deviceId}`);
    expect(device.deviceToken).toMatch(/^[\w-]{43}$/);
    expect(device.webhookSecret).toMatch(/^[\w-]{43}$/);

    const row = await storedDevice(device.deviceId);
    expect(row).toMatchObject({
      platform: "ios",
      locale: "en-MY",
      token_hash: await sha256(device.deviceToken),
    });
    expect(row?.webhook_secret).not.toContain(device.webhookSecret);
    expect(await decryptSecret(row?.webhook_secret ?? "", env.SECRETS_KEY)).toBe(device.webhookSecret);
  });

  it("keeps the device and its hook URL when the same push token registers again, with new credentials", async () => {
    const expoPushToken = newPushToken();
    const first = await (
      await register({ expoPushToken, platform: "ios", locale: "en-MY" })
    ).json<RegisterDeviceResponse>();

    const again = await register({ expoPushToken, platform: "ios", locale: "ms-MY" });

    expect(again.status).toBe(200);
    const second = await again.json<RegisterDeviceResponse>();
    expect(second.deviceId).toBe(first.deviceId);
    expect(second.hookUrl).toBe(first.hookUrl);
    expect(second.deviceToken).not.toBe(first.deviceToken);
    expect(second.webhookSecret).not.toBe(first.webhookSecret);
    expect(await storedDevice(first.deviceId)).toMatchObject({
      locale: "ms-MY",
      token_hash: await sha256(second.deviceToken),
    });
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM devices WHERE push_token = ?")
      .bind(expoPushToken)
      .first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it.each([
    ["not JSON", "{"],
    ["a list", []],
    ["no push token", { platform: "ios", locale: "en" }],
    ["a push token Expo doesn't make", { expoPushToken: "abc", platform: "ios", locale: "en" }],
    ["another platform", { expoPushToken: pushToken, platform: "web", locale: "en" }],
    ["no locale", { expoPushToken: pushToken, platform: "android" }],
    ["a locale that isn't one", { expoPushToken: pushToken, platform: "android", locale: "<script>" }],
  ])("refuses %s", async (_, body) => {
    const response = await register(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  });

  it("limits how often one address can register", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 21; attempt++) {
      const response = await register(
        { expoPushToken: newPushToken(), platform: "android", locale: "en" },
        "198.51.100.7"
      );
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 20).every((status) => status === 201)).toBe(true);
    expect(statuses[20]).toBe(429);
    expect(
      (await register({ expoPushToken: newPushToken(), platform: "ios", locale: "en" }, "198.51.100.8"))
        .status
    ).toBe(201);
  });
});
