import { createCalClient } from "@janji/cal-api/client";
import { CalApiError } from "@janji/cal-api/errors";

import { createPrivateLink, deletePrivateLink, fetchPrivateLinks } from "@/event-types/private-links-api";
import { apiPrivateLink, jsonResponse, privateLinksResponse } from "@/test-utils/fixtures";

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

describe("fetchPrivateLinks", () => {
  it("loads an event type's links, without a cal-api-version, those that still work first", async () => {
    const { client, sent } = clientAnswering(() =>
      privateLinksResponse([
        { id: "used-up", used: 1, max: 1, expired: true },
        { id: "tomorrow", expiresAt: "2026-11-06T15:59:59.999Z" },
      ])
    );

    const links = await fetchPrivateLinks(client, 2);

    expect(sent).toEqual([
      { method: "GET", path: "/api/v2/event-types/2/private-links", version: null, body: null },
    ]);
    expect(links.map((link) => link.id)).toEqual(["tomorrow", "used-up"]);
  });
});

describe("createPrivateLink", () => {
  it("makes a link that works for a number of bookings", async () => {
    const { client, sent } = clientAnswering(() =>
      jsonResponse({ status: "success", data: apiPrivateLink({ id: "n3w", max: 3 }) }, { status: 201 })
    );

    const link = await createPrivateLink(client, 2, { kind: "bookings", max: 3 });

    expect(sent).toEqual([
      {
        method: "POST",
        path: "/api/v2/event-types/2/private-links",
        version: null,
        body: { maxUsageCount: 3 },
      },
    ]);
    expect(link).toEqual({ id: "n3w", limit: { kind: "bookings", used: 0, max: 3 }, expired: false });
  });

  it("makes a link that works until a moment in time", async () => {
    const { client, sent } = clientAnswering(() =>
      jsonResponse(
        { status: "success", data: apiPrivateLink({ id: "n3w", expiresAt: "2026-11-12T15:59:59.999Z" }) },
        { status: 201 }
      )
    );

    await createPrivateLink(client, 2, { kind: "date", expiresAt: new Date("2026-11-12T15:59:59.999Z") });

    expect(sent[0]?.body).toEqual({ expiresAt: "2026-11-12T15:59:59.999Z" });
  });
});

describe("deletePrivateLink", () => {
  it("deletes the link, without a cal-api-version", async () => {
    const { client, sent } = clientAnswering(() =>
      jsonResponse({
        status: "success",
        data: { linkId: "k3Ej9", message: "Private link deleted successfully" },
      })
    );

    await deletePrivateLink(client, 2, "k3Ej9");

    expect(sent).toEqual([
      { method: "DELETE", path: "/api/v2/event-types/2/private-links/k3Ej9", version: null, body: null },
    ]);
  });

  it("counts a link that's already gone as deleted", async () => {
    const { client } = clientAnswering(() =>
      jsonResponse({ status: "error", error: { message: "Deleted link not found" } }, { status: 404 })
    );

    await expect(deletePrivateLink(client, 2, "k3Ej9")).resolves.toBeUndefined();
  });

  it("passes other failures on", async () => {
    const { client } = clientAnswering(() =>
      jsonResponse({ status: "error", error: { message: "Forbidden" } }, { status: 403 })
    );

    await expect(deletePrivateLink(client, 2, "k3Ej9")).rejects.toBeInstanceOf(CalApiError);
  });
});
