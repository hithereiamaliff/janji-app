import { createCalClient } from "@janji/cal-api/client";
import { CalApiError } from "@janji/cal-api/errors";

import {
  connectWebhook,
  disconnectWebhook,
  fetchRelayWebhooks,
  HOOK_TRIGGERS,
  hookPrefix,
} from "@/notifications/webhooks-api";
import { jsonResponse } from "@/test-utils/fixtures";

type Sent = { method: string; path: string; query: string; version: string | null; body: unknown };

/** A client whose requests are answered in turn by `answers`. */
function clientAnswering(answers: (() => Response)[]) {
  const sent: Sent[] = [];
  const client = createCalClient({
    apiRootUrl: "https://book.example.com/api",
    getApiKey: () => "cal_secret",
    fetch: async (request) => {
      const text = await request.text();
      const url = new URL(request.url);
      sent.push({
        method: request.method,
        path: url.pathname,
        query: url.search,
        version: request.headers.get("cal-api-version"),
        body: text ? JSON.parse(text) : null,
      });
      const answer = answers.shift();
      if (!answer) throw new Error("No answer left for this request");
      return answer();
    },
  });
  return { client, sent };
}

function apiWebhook(id: number, subscriberUrl: string) {
  return {
    id,
    subscriberUrl,
    active: true,
    userId: 7,
    payloadTemplate: "",
    triggers: [...HOOK_TRIGGERS],
  };
}

const relay = "https://relay.example";
const hook = (device: string) => `${relay}/v1/hooks/${device}`;

describe("fetchRelayWebhooks", () => {
  it("finds the webhooks pointing at the relay, page by page", async () => {
    const firstPage = Array.from({ length: 250 }, (_, index) =>
      apiWebhook(index + 1, index === 3 ? hook("phone-a") : `https://zapier.example/${index}`)
    );
    const { client, sent } = clientAnswering([
      () => jsonResponse({ status: "success", data: firstPage }),
      () => jsonResponse({ status: "success", data: [apiWebhook(300, hook("phone-b"))] }),
    ]);

    expect(await fetchRelayWebhooks(client, `${relay}/`)).toEqual([
      { id: 4, subscriberUrl: hook("phone-a") },
      { id: 300, subscriberUrl: hook("phone-b") },
    ]);
    expect(sent.map(({ method, path, query, version }) => ({ method, path, query, version }))).toEqual([
      { method: "GET", path: "/api/v2/webhooks", query: "?take=250&skip=0", version: null },
      { method: "GET", path: "/api/v2/webhooks", query: "?take=250&skip=250", version: null },
    ]);
  });

  it("matches the hook path, not just the relay's address", () => {
    expect(hookPrefix("https://relay.example")).toBe("https://relay.example/v1/hooks/");
  });
});

describe("connectWebhook", () => {
  it("creates a webhook for the phone's booking events, signed with the relay's secret", async () => {
    const { client, sent } = clientAnswering([
      () => jsonResponse({ status: "success", data: apiWebhook(41, hook("phone-a")) }, { status: 201 }),
    ]);

    expect(await connectWebhook(client, { hookUrl: hook("phone-a"), secret: "whsec" })).toBe(41);
    expect(sent).toEqual([
      {
        method: "POST",
        path: "/api/v2/webhooks",
        query: "",
        version: null,
        body: {
          subscriberUrl: hook("phone-a"),
          secret: "whsec",
          active: true,
          triggers: ["BOOKING_CREATED", "BOOKING_REQUESTED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"],
        },
      },
    ]);
  });

  it("gives the phone's existing webhook the new secret when Cal.diy already has one", async () => {
    const { client, sent } = clientAnswering([
      () =>
        jsonResponse(
          {
            status: "error",
            error: { message: "Webhook with this subscriber url already exists for this user" },
          },
          { status: 409 }
        ),
      () =>
        jsonResponse({
          status: "success",
          data: [apiWebhook(12, hook("phone-other")), apiWebhook(41, hook("phone-a"))],
        }),
      () => jsonResponse({ status: "success", data: apiWebhook(41, hook("phone-a")) }),
    ]);

    expect(await connectWebhook(client, { hookUrl: hook("phone-a"), secret: "whsec-new" })).toBe(41);
    expect(sent[2]).toEqual({
      method: "PATCH",
      path: "/api/v2/webhooks/41",
      query: "",
      version: null,
      body: { secret: "whsec-new", active: true, triggers: [...HOOK_TRIGGERS] },
    });
  });

  it("passes on other failures", async () => {
    const { client } = clientAnswering([
      () => jsonResponse({ status: "error", error: { message: "bad" } }, { status: 400 }),
    ]);

    await expect(
      connectWebhook(client, { hookUrl: hook("phone-a"), secret: "whsec" })
    ).rejects.toBeInstanceOf(CalApiError);
  });
});

describe("disconnectWebhook", () => {
  it("deletes the webhook", async () => {
    const { client, sent } = clientAnswering([
      () => jsonResponse({ status: "success", data: apiWebhook(41, hook("phone-a")) }),
    ]);

    await disconnectWebhook(client, 41);

    expect(sent[0]).toMatchObject({ method: "DELETE", path: "/api/v2/webhooks/41", version: null });
  });
});
