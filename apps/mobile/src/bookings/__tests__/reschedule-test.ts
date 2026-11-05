import { createCalClient } from "@janji/cal-api/client";

import { fetchRescheduleSlots, rescheduleBooking, slotStarts } from "@/bookings/reschedule";
import { apiBooking, jsonResponse } from "@/test-utils/fixtures";

type SentRequest = { method: string; url: URL; version: string | null; body: unknown };

function clientAnswering(response: () => Response) {
  const sent: SentRequest[] = [];
  const client = createCalClient({
    apiRootUrl: "https://book.example.com/api",
    getApiKey: () => "cal_secret",
    fetch: async (request) => {
      const text = await request.text();
      sent.push({
        method: request.method,
        url: new URL(request.url),
        version: request.headers.get("cal-api-version"),
        body: text ? JSON.parse(text) : null,
      });
      return response();
    },
  });
  return { client, sent };
}

describe("slotStarts", () => {
  it("reads every day's start times in order, whatever shape each slot takes", () => {
    const body = {
      status: "success",
      data: {
        "2026-11-07": [{ start: "2026-11-07T09:00:00.000+08:00" }],
        "2026-11-06": [
          { start: "2026-11-06T14:00:00.000+08:00", seatsRemaining: 2 },
          "2026-11-06T09:30:00.000+08:00",
        ],
      },
    };

    expect(slotStarts(body)).toEqual([
      "2026-11-06T09:30:00.000+08:00",
      "2026-11-06T14:00:00.000+08:00",
      "2026-11-07T09:00:00.000+08:00",
    ]);
  });

  it.each([null, {}, { data: [] }, { data: { "2026-11-06": "soon" } }])("finds nothing in %j", (body) => {
    expect(slotStarts(body)).toEqual([]);
  });
});

describe("fetchRescheduleSlots", () => {
  it("asks for slots at the booking's length that count its own time as free", async () => {
    const { client, sent } = clientAnswering(() =>
      jsonResponse({ status: "success", data: { "2026-11-06": [{ start: "2026-11-06T09:00:00.000Z" }] } })
    );

    const starts = await fetchRescheduleSlots(client, {
      eventTypeId: 3,
      uid: "b1",
      durationMinutes: 45,
      from: new Date("2026-11-06T00:00:00Z"),
      to: new Date("2026-11-19T23:59:59Z"),
      timeZone: "Asia/Kuala_Lumpur",
    });

    expect(starts).toEqual(["2026-11-06T09:00:00.000Z"]);
    const request = sent[0];
    expect(request?.url.pathname).toBe("/api/v2/slots");
    expect(request?.version).toBe("2024-09-04");
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
      eventTypeId: "3",
      bookingUidToReschedule: "b1",
      duration: "45",
      start: "2026-11-06T00:00:00.000Z",
      end: "2026-11-19T23:59:59.000Z",
      timeZone: "Asia/Kuala_Lumpur",
    });
  });
});

describe("rescheduleBooking", () => {
  it("moves the booking as the host and returns the new booking's uid", async () => {
    const moved = apiBooking({ uid: "b2", title: "Itinerary review", start: "2026-11-07T01:00:00Z" });
    const { client, sent } = clientAnswering(() => jsonResponse({ status: "success", data: moved }));

    const uid = await rescheduleBooking(client, "b1", {
      start: "2026-11-07T09:00:00.000+08:00",
      rescheduledBy: "alan@example.com",
      reason: "  Flight moved  ",
    });

    expect(uid).toBe("b2");
    expect(sent[0]).toMatchObject({
      method: "POST",
      version: "2024-08-13",
      body: {
        start: "2026-11-07T01:00:00.000Z",
        rescheduledBy: "alan@example.com",
        reschedulingReason: "Flight moved",
      },
    });
    expect(sent[0]?.url.pathname).toBe("/api/v2/bookings/b1/reschedule");
  });

  it("leaves out a blank reason", async () => {
    const { client, sent } = clientAnswering(() =>
      jsonResponse({
        status: "success",
        data: apiBooking({ uid: "b2", title: "Call", start: "2026-11-07T01:00:00Z" }),
      })
    );

    await rescheduleBooking(client, "b1", {
      start: "2026-11-07T01:00:00Z",
      rescheduledBy: "alan@example.com",
      reason: " ",
    });

    expect(sent[0]?.body).toEqual({ start: "2026-11-07T01:00:00.000Z", rescheduledBy: "alan@example.com" });
  });
});
