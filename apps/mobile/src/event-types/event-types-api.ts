import { type CalClient, unwrap } from "@janji/cal-api/client";

import { type EventTypeSummary, toEventTypeSummary } from "./event-type";

/** The signed-in person's event types, hidden ones included, in the order Cal.diy keeps them. */
export async function fetchEventTypes(client: CalClient): Promise<EventTypeSummary[]> {
  const body = unwrap(await client.GET("/v2/event-types"));
  return body.data.map(toEventTypeSummary);
}

/** Shows an event type on the public booking page, or hides it from there. */
export async function setEventTypeHidden(
  client: CalClient,
  id: number,
  hidden: boolean
): Promise<EventTypeSummary> {
  const body = unwrap(
    await client.PATCH("/v2/event-types/{eventTypeId}", {
      params: { path: { eventTypeId: id } },
      body: { hidden },
    })
  );
  return toEventTypeSummary(body.data);
}
