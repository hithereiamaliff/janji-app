import { createExecutionContext, createScheduledController, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { RegisterDeviceResponse } from "@janji/shared/relay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkReceipts } from "../src/expo";
import worker from "../src/index";
import { signature, webhookBody } from "./webhooks";

const MINUTE = 60_000;
let devices = 0;

async function registered(): Promise<RegisterDeviceResponse> {
  const response = await worker.fetch(
    new Request("https://relay.test/v1/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.30" },
      body: JSON.stringify({
        expoPushToken: `ExponentPushToken[receipt-${++devices}]`,
        platform: "android",
        locale: "en",
      }),
    }),
    env,
    createExecutionContext()
  );
  return response.json();
}

async function deliver(device: RegisterDeviceResponse, uid: string) {
  const body = webhookBody({ uid });
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request(device.hookUrl, {
      method: "POST",
      headers: { "X-Cal-Signature-256": await signature(device.webhookSecret, body) },
      body,
    }),
    env,
    ctx
  );
  await waitOnExecutionContext(ctx);
  return response;
}

/** Answers Expo's push API with `ticket`, and its receipts API with `receipts`. */
function expo(ticket: unknown, receipts: Record<string, unknown> = {}) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) =>
      String(input).endsWith("/getReceipts")
        ? Response.json({ data: receipts })
        : Response.json({ data: [ticket] })
    );
}

async function ticketsOf(deviceId: string): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT id FROM push_tickets WHERE device_id = ? ORDER BY id")
    .bind(deviceId)
    .all<{ id: string }>();
  return results.map((row) => row.id);
}

async function deviceExists(deviceId: string): Promise<boolean> {
  return (await env.DB.prepare("SELECT 1 FROM devices WHERE id = ?").bind(deviceId).first()) !== null;
}

async function ticket(id: string, deviceId: string, createdAt: number) {
  await env.DB.prepare("INSERT INTO push_tickets (id, device_id, created_at) VALUES (?, ?, ?)")
    .bind(id, deviceId, createdAt)
    .run();
}

const gone = { status: "error", message: "not registered", details: { error: "DeviceNotRegistered" } };

describe("Expo's tickets", () => {
  afterEach(() => vi.restoreAllMocks());

  it("are kept with the device until their receipt comes", async () => {
    const device = await registered();
    expo({ status: "ok", id: "ticket-kept" });

    await deliver(device, "booking-kept");

    expect(await ticketsOf(device.deviceId)).toEqual(["ticket-kept"]);
  });

  it("forget a phone Expo already knows is gone, whose hook then answers 410", async () => {
    const device = await registered();
    expo(gone);

    await deliver(device, "booking-gone");

    expect(await deviceExists(device.deviceId)).toBe(false);
    expect((await deliver(device, "booking-after")).status).toBe(410);
  });
});

describe("Expo's receipts", () => {
  // Tests in a file share one database, and these count every ticket in it.
  beforeEach(() => env.DB.prepare("DELETE FROM push_tickets").run());
  afterEach(() => vi.restoreAllMocks());

  it("are asked for once tickets are 15 minutes old, and say which phones to forget", async () => {
    const now = Date.now();
    const reachable = await registered();
    const unreachable = await registered();
    await ticket("ready-ok", reachable.deviceId, now - 20 * MINUTE);
    await ticket("ready-missing", reachable.deviceId, now - 19 * MINUTE);
    await ticket("ready-gone", unreachable.deviceId, now - 18 * MINUTE);
    await ticket("too-young", reachable.deviceId, now - 5 * MINUTE);
    await ticket("too-old", reachable.deviceId, now - 25 * 60 * MINUTE);
    const spy = expo(undefined, { "ready-ok": { status: "ok" }, "ready-gone": gone });

    await checkReceipts(env, now);

    const [url, init] = spy.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://exp.host/--/api/v2/push/getReceipts");
    expect(JSON.parse(String(init?.body))).toEqual({ ids: ["ready-ok", "ready-missing", "ready-gone"] });
    // A receipt that isn't ready yet is asked for again; the ticket too old for one is dropped.
    expect(await ticketsOf(reachable.deviceId)).toEqual(["ready-missing", "too-young"]);
    expect(await deviceExists(unreachable.deviceId)).toBe(false);
    expect(await ticketsOf(unreachable.deviceId)).toEqual([]);
  });

  it("aren't asked for when no ticket is old enough", async () => {
    const device = await registered();
    await ticket("young", device.deviceId, Date.now() - MINUTE);
    const spy = expo(undefined);

    await checkReceipts(env);

    expect(spy).not.toHaveBeenCalled();
  });

  it("are checked by the scheduled run", async () => {
    const device = await registered();
    await ticket("scheduled", device.deviceId, Date.now() - 16 * MINUTE);
    const spy = expo(undefined, { scheduled: { status: "ok" } });
    const ctx = createExecutionContext();

    await worker.scheduled(createScheduledController({ cron: "*/15 * * * *" }), env, ctx);
    await waitOnExecutionContext(ctx);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(await ticketsOf(device.deviceId)).toEqual([]);
  });
});
