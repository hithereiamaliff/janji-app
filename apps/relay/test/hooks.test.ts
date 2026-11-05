import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { RegisterDeviceResponse } from "@janji/shared/relay";
import { afterEach, describe, expect, it, vi } from "vitest";

import worker from "../src/index";
import { signature, type WebhookOptions, webhookBody } from "./webhooks";

let tokens = 0;

async function registered(): Promise<RegisterDeviceResponse> {
  const response = await worker.fetch(
    new Request("https://relay.test/v1/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.20" },
      body: JSON.stringify({
        expoPushToken: `ExponentPushToken[hook-${++tokens}]`,
        platform: "ios",
        locale: "en-GB",
      }),
    }),
    env,
    createExecutionContext()
  );
  return response.json();
}

let tickets = 0;

/** Expo's push API, answered as it does for a push it accepted. */
function expo() {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => Response.json({ data: [{ status: "ok", id: `ticket-${++tickets}` }] }));
}

/** Posts a webhook the way Cal.diy does, then waits for the work done after answering. */
async function deliver(hookUrl: string, body: string, signed: string) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request(hookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Cal-Signature-256": signed },
      body,
    }),
    env,
    ctx
  );
  await waitOnExecutionContext(ctx);
  return response;
}

async function deliverSigned(device: RegisterDeviceResponse, options: WebhookOptions = {}) {
  const body = webhookBody(options);
  return deliver(device.hookUrl, body, await signature(device.webhookSecret, body));
}

const sentPushes = (spy: ReturnType<typeof expo>) =>
  spy.mock.calls.flatMap(([, init]) => JSON.parse(String(init?.body)));

describe("a Cal.diy webhook", () => {
  afterEach(() => vi.restoreAllMocks());

  it("becomes a push to the phone", async () => {
    const device = await registered();
    const spy = expo();

    const response = await deliverSigned(device);

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://exp.host/--/api/v2/push/send");
    expect(new Headers(init?.headers).get("Authorization")).toBeNull();
    expect(sentPushes(spy)).toEqual([
      {
        to: `ExponentPushToken[hook-${tokens}]`,
        title: "New booking",
        body: "Consultation · Thu 12 Nov, 15:00 · Jane",
        data: { bookingUid: "booking-1" },
        sound: "default",
        priority: "high",
      },
    ]);
  });

  it("is answered before the push is sent, since Cal.diy waits for the answer", async () => {
    const device = await registered();
    let finishSending = () => {};
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSending = () =>
            resolve(Response.json({ data: [{ status: "ok", id: `ticket-${++tickets}` }] }));
        })
    );
    const body = webhookBody();
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

    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    finishSending();
    await waitOnExecutionContext(ctx);
  });

  it("sends one push when the same webhook comes twice", async () => {
    const device = await registered();
    const spy = expo();

    await deliverSigned(device);
    await deliverSigned(device);
    await deliverSigned(device, { trigger: "BOOKING_CANCELLED" });

    expect(sentPushes(spy).map((push) => push.title)).toEqual(["New booking", "Cancelled"]);
  });

  it("sends one push for a whole recurring series", async () => {
    const device = await registered();
    const spy = expo();

    await deliverSigned(device, { recurring: true, uid: "occurrence-1" });
    await deliverSigned(device, { recurring: true, uid: "occurrence-2" });

    expect(sentPushes(spy).map((push) => push.title)).toEqual(["New recurring booking"]);
  });

  it("is refused without the device's signature", async () => {
    const device = await registered();
    const other = await registered();
    const spy = expo();
    const body = webhookBody();

    expect((await deliver(device.hookUrl, body, await signature(other.webhookSecret, body))).status).toBe(
      401
    );
    expect((await deliver(device.hookUrl, body, "no-secret-provided")).status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });

  it("is refused when it's too old to be anything but a replay", async () => {
    const device = await registered();
    const spy = expo();

    const response = await deliverSigned(device, {
      createdAt: new Date(Date.now() - 11 * 60_000).toISOString(),
    });

    expect(response.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("is acknowledged without a push when it's about something else", async () => {
    const device = await registered();
    const spy = expo();

    expect((await deliverSigned(device, { trigger: "MEETING_ENDED" })).status).toBe(200);
    expect(spy).not.toHaveBeenCalled();
  });

  it("is told the hook is gone once the device is", async () => {
    const spy = expo();
    const body = webhookBody();

    const response = await deliver("https://relay.test/v1/hooks/aaaaaaaaaaaaaaaaaaaaaa", body, "00");

    expect(response.status).toBe(410);
    expect(spy).not.toHaveBeenCalled();
  });

  it("is refused when it's far too big to be a booking", async () => {
    const device = await registered();
    const body = webhookBody().replace('"type":"consultation"', `"type":"${"x".repeat(300 * 1024)}"`);

    const response = await deliver(device.hookUrl, body, await signature(device.webhookSecret, body));

    expect(response.status).toBe(413);
  });
});
