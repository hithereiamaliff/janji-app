import { type CalClient, unwrap } from "@janji/cal-api/client";
import { CalApiError } from "@janji/cal-api/errors";

import { type PrivateLink, sortPrivateLinks, toPrivateLink } from "./private-links";

// These requests go without a cal-api-version: API v2 answers private links only on its default version.

export async function fetchPrivateLinks(client: CalClient, eventTypeId: number): Promise<PrivateLink[]> {
  const body = unwrap(
    await client.GET("/v2/event-types/{eventTypeId}/private-links", { params: { path: { eventTypeId } } })
  );
  return sortPrivateLinks(body.data.map(toPrivateLink));
}

/** When a new link stops working. Cal.diy takes exactly one of the two. */
export type NewPrivateLinkLimit = { kind: "date"; expiresAt: Date } | { kind: "bookings"; max: number };

export async function createPrivateLink(
  client: CalClient,
  eventTypeId: number,
  limit: NewPrivateLinkLimit
): Promise<PrivateLink> {
  const body = unwrap(
    await client.POST("/v2/event-types/{eventTypeId}/private-links", {
      params: { path: { eventTypeId } },
      body:
        limit.kind === "date" ? { expiresAt: limit.expiresAt.toISOString() } : { maxUsageCount: limit.max },
    })
  );
  return toPrivateLink(body.data);
}

/** Deletes a private link, so it stops working at once. A link that's already gone counts as deleted. */
export async function deletePrivateLink(
  client: CalClient,
  eventTypeId: number,
  linkId: string
): Promise<void> {
  try {
    unwrap(
      await client.DELETE("/v2/event-types/{eventTypeId}/private-links/{linkId}", {
        params: { path: { eventTypeId, linkId } },
      })
    );
  } catch (error) {
    if (error instanceof CalApiError && error.kind === "not_found") return;
    throw error;
  }
}
