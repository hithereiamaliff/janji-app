import { type CalClient, unwrap } from "@janji/cal-api/client";
import { CalApiError } from "@janji/cal-api/errors";

/**
 * The booking events a phone's webhook is subscribed to. BOOKING_PAID isn't one: a paid booking fires
 * BOOKING_CREATED or BOOKING_REQUESTED as well, so it would alert twice.
 */
export const HOOK_TRIGGERS = [
  "BOOKING_CREATED",
  "BOOKING_REQUESTED",
  "BOOKING_RESCHEDULED",
  "BOOKING_CANCELLED",
] as const;

export type HookTrigger = (typeof HOOK_TRIGGERS)[number];

/** A Cal.diy webhook that sends a phone's notifications through the relay. */
export type HookWebhook = { id: number; subscriberUrl: string };

// API v2 lists 250 webhooks at a time unless asked for fewer.
const PAGE = 250;

/** Where the relay's hook URLs start: "https://relay.example/v1/hooks/". */
export function hookPrefix(relayOrigin: string): string {
  return `${relayOrigin.replace(/\/+$/, "")}/v1/hooks/`;
}

/** The person's webhooks that point at the relay, which are the app's own: one for each phone. */
export async function fetchRelayWebhooks(client: CalClient, relayOrigin: string): Promise<HookWebhook[]> {
  const prefix = hookPrefix(relayOrigin);
  const found: HookWebhook[] = [];
  for (let skip = 0; ; skip += PAGE) {
    const { data } = unwrap(await client.GET("/v2/webhooks", { params: { query: { take: PAGE, skip } } }));
    for (const { id, subscriberUrl } of data) {
      if (subscriberUrl.startsWith(prefix)) found.push({ id, subscriberUrl });
    }
    if (data.length < PAGE) return found;
  }
}

/**
 * Points a webhook at the phone's hook URL, signed with the relay's secret, and returns its ID. Cal.diy
 * allows one webhook per URL, and the relay keeps a phone's hook URL when it registers again, as after a
 * reinstall; so when one already exists, it's given the new secret instead.
 */
export async function connectWebhook(
  client: CalClient,
  {
    hookUrl,
    secret,
    triggers = HOOK_TRIGGERS,
  }: { hookUrl: string; secret: string; triggers?: readonly HookTrigger[] }
): Promise<number> {
  const settings = { secret, active: true, triggers: [...triggers] };
  try {
    return unwrap(await client.POST("/v2/webhooks", { body: { subscriberUrl: hookUrl, ...settings } })).data
      .id;
  } catch (error) {
    if (!(error instanceof CalApiError) || error.kind !== "conflict") throw error;
  }
  const existing = (await fetchRelayWebhooks(client, new URL(hookUrl).origin)).find(
    (webhook) => webhook.subscriberUrl === hookUrl
  );
  if (!existing) throw new Error("Cal.diy says this phone's webhook exists, but doesn't list it");
  unwrap(
    await client.PATCH("/v2/webhooks/{webhookId}", {
      params: { path: { webhookId: String(existing.id) } },
      body: settings,
    })
  );
  return existing.id;
}

export async function disconnectWebhook(client: CalClient, id: number): Promise<void> {
  unwrap(await client.DELETE("/v2/webhooks/{webhookId}", { params: { path: { webhookId: String(id) } } }));
}

/** Changes which booking events a phone's webhook sends it. */
export async function setWebhookTriggers(
  client: CalClient,
  id: number,
  triggers: readonly HookTrigger[]
): Promise<void> {
  unwrap(
    await client.PATCH("/v2/webhooks/{webhookId}", {
      params: { path: { webhookId: String(id) } },
      body: { triggers: [...triggers] },
    })
  );
}
