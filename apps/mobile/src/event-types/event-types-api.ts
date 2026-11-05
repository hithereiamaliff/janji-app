import { type CalClient, unwrap } from "@janji/cal-api/client";
import { CalApiError } from "@janji/cal-api/errors";

import { type EventTypeSummary, toEventTypeSummary } from "./event-type";

/** The signed-in person's event types, hidden ones included, in the order Cal.diy keeps them. */
export async function fetchEventTypes(client: CalClient): Promise<EventTypeSummary[]> {
  const body = unwrap(await client.GET("/v2/event-types"));
  return body.data.map(toEventTypeSummary);
}

/** The settings the app can change. Only what's given is sent, so everything else stays as it is. */
export type EventTypeChanges = {
  title?: string;
  slug?: string;
  lengthInMinutes?: number;
  description?: string;
  /** In minutes. */
  minimumBookingNotice?: number;
  /** Leaves the event type off the public booking page. */
  hidden?: boolean;
  /**
   * The schedule its hours come from. API v2 takes a schedule's ID here but no way back to "the default",
   * so the app only ever sets one, as the web's schedule menu does.
   */
  scheduleId?: number;
};

export async function updateEventType(
  client: CalClient,
  id: number,
  changes: EventTypeChanges
): Promise<EventTypeSummary> {
  const body = unwrap(
    await client.PATCH("/v2/event-types/{eventTypeId}", {
      params: { path: { eventTypeId: id } },
      body: changes,
    })
  );
  return toEventTypeSummary(body.data);
}

/**
 * Whether Cal.diy refused a change because another of the person's event types already uses the slug. The app
 * checks this itself before saving, so it only happens when that other event type was set up meanwhile.
 */
export function isSlugTakenError(error: unknown): boolean {
  return error instanceof CalApiError && error.serverMessage === "error_event_type_url_duplicate";
}
