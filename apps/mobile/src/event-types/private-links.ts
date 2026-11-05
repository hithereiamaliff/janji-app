import type { components } from "@janji/cal-api/schema";

export type ApiPrivateLink =
  | components["schemas"]["TimeBasedPrivateLinkOutput"]
  | components["schemas"]["UsageBasedPrivateLinkOutput"];

/** What stops a private link working: a moment in time, or a number of bookings made with it. */
export type PrivateLinkLimit =
  | { kind: "date"; expiresAt: string }
  | { kind: "bookings"; used: number; max: number };

export type PrivateLink = {
  /** The code in the link, which Cal.diy also uses as its ID. */
  id: string;
  limit: PrivateLinkLimit;
  /** Past its date or out of bookings, so it no longer lets anyone book. */
  expired: boolean;
};

export function toPrivateLink(link: ApiPrivateLink): PrivateLink {
  return {
    id: link.linkId,
    limit:
      "expiresAt" in link
        ? { kind: "date", expiresAt: link.expiresAt }
        : { kind: "bookings", used: link.usageCount, max: link.maxUsageCount },
    expired: link.isExpired,
  };
}

/**
 * The link to share. API v2 sends a bookingUrl too, but it leaves out the event type's slug, which the booking
 * page needs, and it falls back to cal.com when a self-hosted API v2 doesn't set the web app's address.
 */
export function privateLinkUrl(serverOrigin: string, linkId: string, slug: string): string {
  return `${serverOrigin.replace(/\/+$/, "")}/d/${encodeURIComponent(linkId)}/${encodeURIComponent(slug)}`;
}

function rank(link: PrivateLink): number {
  if (link.expired) return 2;
  return link.limit.kind === "date" ? 0 : 1;
}

/**
 * In the order Cal.diy's web app lists them: links that still work first, those ending on a date before those
 * limited to a number of bookings, and the soonest to end at the top. Cal.diy sends them in no set order.
 */
export function sortPrivateLinks(links: readonly PrivateLink[]): PrivateLink[] {
  return [...links].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0 || a.expired) return byRank;
    if (a.limit.kind === "date" && b.limit.kind === "date") {
      return Date.parse(a.limit.expiresAt) - Date.parse(b.limit.expiresAt);
    }
    return 0;
  });
}
