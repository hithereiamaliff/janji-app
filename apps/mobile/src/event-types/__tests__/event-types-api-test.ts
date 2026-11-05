import { createCalClient } from "@janji/cal-api/client";

import { fetchEventTypes, isSlugTakenError, updateEventType } from "@/event-types/event-types-api";
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

describe("updateEventType", () => {
  it("sends only the settings being changed", async () => {
    const { client, sent } = clientAnswering(() =>
      jsonResponse({
        status: "success",
        data: apiEventType({ id: 2, title: "Consultation", slug: "consultation", hidden: false }),
      })
    );

    const updated = await updateEventType(client, 2, { hidden: false });

    expect(sent).toEqual([
      { method: "PATCH", path: "/api/v2/event-types/2", version: "2024-06-14", body: { hidden: false } },
    ]);
    expect(updated).toMatchObject({ id: 2, hidden: false });
  });

  it("changes several settings at once", async () => {
    const { client, sent } = clientAnswering(() =>
      jsonResponse({
        status: "success",
        data: apiEventType({
          id: 2,
          title: "Planning call",
          slug: "planning",
          lengthInMinutes: 45,
          minimumBookingNotice: 120,
        }),
      })
    );

    const updated = await updateEventType(client, 2, {
      title: "Planning call",
      slug: "planning",
      lengthInMinutes: 45,
      minimumBookingNotice: 120,
    });

    expect(sent[0]?.body).toEqual({
      title: "Planning call",
      slug: "planning",
      lengthInMinutes: 45,
      minimumBookingNotice: 120,
    });
    expect(updated).toMatchObject({
      title: "Planning call",
      slug: "planning",
      lengthInMinutes: 45,
      minimumBookingNotice: 120,
    });
  });
});

describe("isSlugTakenError", () => {
  async function refusal(message: string, status: number): Promise<unknown> {
    const { client } = clientAnswering(() =>
      jsonResponse({ status: "error", error: { code: "TRPCError", message } }, { status })
    );
    return updateEventType(client, 2, { slug: "chat" }).catch((error: unknown) => error);
  }

  it("recognises Cal.diy refusing a slug another event type has", async () => {
    expect(isSlugTakenError(await refusal("error_event_type_url_duplicate", 400))).toBe(true);
  });

  it("doesn't mistake other refusals for it", async () => {
    expect(isSlugTakenError(await refusal("Event type with id 2 not found", 404))).toBe(false);
    expect(isSlugTakenError(new Error("error_event_type_url_duplicate"))).toBe(false);
  });
});
