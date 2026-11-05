import type { components } from "@janji/cal-api/schema";

export type ApiEventType = components["schemas"]["EventTypeOutput_2024_06_14"];

export type EventTypeSummary = {
  id: number;
  title: string;
  slug: string;
  /** The length a booking gets unless the booker picks another. */
  lengthInMinutes: number;
  /** Every length a booker can choose from, shortest first, when there's a choice; otherwise empty. */
  lengthOptions: number[];
  description: string | null;
  /** How long before its start a booking must be made, in minutes. */
  minimumBookingNotice: number;
  /** Left off the public booking page, though still bookable through its own link. */
  hidden: boolean;
};

export function toEventTypeSummary(eventType: ApiEventType): EventTypeSummary {
  const options = new Set(eventType.lengthInMinutesOptions ?? []);
  return {
    id: eventType.id,
    title: eventType.title,
    slug: eventType.slug,
    lengthInMinutes: eventType.lengthInMinutes,
    lengthOptions: options.size > 0 ? [...options.add(eventType.lengthInMinutes)].sort((a, b) => a - b) : [],
    description: eventType.description.trim() || null,
    minimumBookingNotice: eventType.minimumBookingNotice ?? 0,
    hidden: eventType.hidden,
  };
}

/**
 * The event type's public booking page. API v2 sends a bookingUrl too, but builds it from its WEBSITE_URL
 * setting, which falls back to cal.com when a self-hosted API v2 doesn't set it. The web app at the address
 * the person signed in with always serves booking pages.
 */
export function bookingLink(serverOrigin: string, username: string, slug: string): string {
  return `${serverOrigin.replace(/\/+$/, "")}/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
}

/** A booking link as people read it: no scheme, and a slug in any script shown as typed, not percent-encoded. */
export function readableLink(link: string): string {
  return decodeURI(link).replace(/^https?:\/\//, "");
}
