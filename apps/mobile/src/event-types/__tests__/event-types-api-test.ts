import { createCalClient } from "@janji/cal-api/client";

import { fetchEventTypes, setEventTypeHidden } from "@/event-types/event-types-api";
import { apiEventType, eventTypesResponse, jsonResponse } from "@/test-utils/fixtures";

type SentRequest = { method: string; path: string; version: string | null; body: unknown };

function clientAnswering(response: () => Response) {
  const sent: SentRequest[] = [];
  const client = createCalClient({
    apiRootUrl: "https://book.example.com/api",
    getApiKey: () => "cal_secret",
    fetch: async (request) => {
      const text = await request.text();
      sent.push({
        method: request.method,
        path: new URL(request.url).pathname,
        version: request.headers.get("cal-api-version"),
        body: text ? JSON.parse(text) : null,
      });
      return response();
    },
  });
  return { client, sent };
}

describe("fetchEventTypes", () => {
  it("loads the signed-in person's event types", async () => {
    const { client, sent } = clientAnswering(() =>
      eventTypesResponse([
        { id: 1, title: "Call", slug: "call" },
        { id: 2, title: "Consultation", slug: "consultation", hidden: true },
      ])
    );

    const eventTypes = await fetchEventTypes(client);

    expect(sent).toEqual([{ method: "GET", path: "/api/v2/event-types", version: "2024-06-14", body: null }]);
    expect(eventTypes.map(({ id, hidden }) => ({ id, hidden }))).toEqual([
      { id: 1, hidden: false },
      { id: 2, hidden: true },
    ]);
  });
});

describe("setEventTypeHidden", () => {
  it("changes only whether the event type is hidden", async () => {
    const { client, sent } = clientAnswering(() =>
      jsonResponse({
        status: "success",
        data: apiEventType({ id: 2, title: "Consultation", slug: "consultation", hidden: false }),
      })
    );

    const updated = await setEventTypeHidden(client, 2, false);

    expect(sent).toEqual([
      { method: "PATCH", path: "/api/v2/event-types/2", version: "2024-06-14", body: { hidden: false } },
    ]);
    expect(updated).toMatchObject({ id: 2, hidden: false });
  });
});
