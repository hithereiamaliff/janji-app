import { createRelayClient, RelayRequestError } from "@/notifications/relay-client";
import { jsonResponse } from "@/test-utils/fixtures";

type Sent = { method: string; url: string; authorization: string | null; body: unknown };

function relayAnswering(answers: (() => Response | Promise<Response>)[]) {
  const sent: Sent[] = [];
  const relay = createRelayClient("https://relay.example/", async (request) => {
    const text = await request.text();
    sent.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.get("Authorization"),
      body: text ? JSON.parse(text) : null,
    });
    const answer = answers.shift();
    if (!answer) throw new Error("No answer left for this request");
    return answer();
  });
  return { relay, sent };
}

const device = { deviceId: "d".repeat(22), deviceToken: "device-token" };
const registration = { expoPushToken: "ExponentPushToken[abc]", platform: "ios" as const, locale: "en-MY" };

describe("the relay client", () => {
  it("registers the phone", async () => {
    const answer = { ...device, hookUrl: "https://relay.example/v1/hooks/x", webhookSecret: "whsec" };
    const { relay, sent } = relayAnswering([() => jsonResponse(answer, { status: 201 })]);

    expect(await relay.register(registration)).toEqual(answer);
    expect(sent).toEqual([
      { method: "POST", url: "https://relay.example/v1/devices", authorization: null, body: registration },
    ]);
  });

  it("changes and removes the phone with its own token", async () => {
    const { relay, sent } = relayAnswering([
      () => new Response(null, { status: 204 }),
      () => new Response(null, { status: 204 }),
    ]);

    await relay.update(device, { locale: "ms-MY" });
    await relay.remove(device);

    expect(sent).toEqual([
      {
        method: "PATCH",
        url: `https://relay.example/v1/devices/${device.deviceId}`,
        authorization: "Bearer device-token",
        body: { locale: "ms-MY" },
      },
      {
        method: "DELETE",
        url: `https://relay.example/v1/devices/${device.deviceId}`,
        authorization: "Bearer device-token",
        body: null,
      },
    ]);
  });

  it("counts a phone the relay no longer has as removed", async () => {
    const { relay } = relayAnswering([() => jsonResponse({ error: "not_found" }, { status: 404 })]);

    await expect(relay.remove(device)).resolves.toBeUndefined();
  });

  it("asks which devices it still has, 100 at a time", async () => {
    const ids = Array.from({ length: 150 }, (_, index) => `device-${index}`);
    const { relay, sent } = relayAnswering([
      () => jsonResponse({ known: ["device-1"] }),
      () => jsonResponse({ known: ["device-120"] }),
    ]);

    expect(await relay.knownDevices(ids)).toEqual(["device-1", "device-120"]);
    expect(sent.map((request) => (request.body as { deviceIds: string[] }).deviceIds.length)).toEqual([
      100, 50,
    ]);
    expect(await relay.knownDevices([])).toEqual([]);
  });

  it("says why a request failed, or that the relay couldn't be reached", async () => {
    const { relay } = relayAnswering([
      () => jsonResponse({ error: "push_token_taken" }, { status: 409 }),
      () => Promise.reject(new TypeError("Network request failed")),
    ]);

    await expect(relay.update(device, { expoPushToken: "ExponentPushToken[other]" })).rejects.toMatchObject({
      status: 409,
      code: "push_token_taken",
    });
    const offline = relay.register(registration);
    await expect(offline).rejects.toBeInstanceOf(RelayRequestError);
    await expect(offline).rejects.toMatchObject({ status: null, code: null });
  });
});
