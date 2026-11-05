import { createCalClient } from "@janji/cal-api/client";
import { CalApiError } from "@janji/cal-api/errors";

import {
  addGuests,
  cancelBooking,
  confirmBooking,
  declineBooking,
  markNoShow,
} from "@/bookings/booking-actions";
import { apiBooking, jsonResponse, type TestBooking } from "@/test-utils/fixtures";

const booking: TestBooking = {
  uid: "b1",
  title: "Itinerary review",
  start: "2026-11-06T08:00:00Z",
  end: "2026-11-06T09:00:00Z",
  status: "pending",
};

type SentRequest = {
  method: string;
  path: string;
  version: string | null;
  body: unknown;
};

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

const answering = (data: unknown) => () => jsonResponse({ status: "success", data });

describe("booking actions", () => {
  it("confirms a booking and returns it as the server now has it", async () => {
    const { client, sent } = clientAnswering(answering(apiBooking({ ...booking, status: "accepted" })));

    const updated = await confirmBooking(client, "b1");

    expect(sent).toEqual([
      { method: "POST", path: "/api/v2/bookings/b1/confirm", version: "2024-08-13", body: null },
    ]);
    expect(updated).toMatchObject({ uid: "b1", status: "accepted" });
  });

  it("declines with the reason, if one is given", async () => {
    const { client, sent } = clientAnswering(answering(apiBooking({ ...booking, status: "rejected" })));

    await declineBooking(client, "b1", "  Fully booked that week  ");
    await declineBooking(client, "b1", " ");

    expect(sent.map(({ path, version, body }) => ({ path, version, body }))).toEqual([
      {
        path: "/api/v2/bookings/b1/decline",
        version: "2024-08-13",
        body: { reason: "Fully booked that week" },
      },
      { path: "/api/v2/bookings/b1/decline", version: "2024-08-13", body: {} },
    ]);
  });

  it("cancels with the reason", async () => {
    const { client, sent } = clientAnswering(answering(apiBooking({ ...booking, status: "cancelled" })));

    const updated = await cancelBooking(client, "b1", { reason: " Flight cancelled " });

    expect(sent[0]).toEqual({
      method: "POST",
      path: "/api/v2/bookings/b1/cancel",
      version: "2024-08-13",
      body: { cancellationReason: "Flight cancelled" },
    });
    expect(updated?.status).toBe("cancelled");
  });

  it("cancels later occurrences too when asked, finding this one in the series that comes back", async () => {
    const series = ["b1", "b2"].map((uid, index) =>
      apiBooking({ ...booking, uid, status: "cancelled", recurringBookingUid: "series-1" }, index + 1)
    );
    const { client, sent } = clientAnswering(answering(series));

    const updated = await cancelBooking(client, "b2", {
      reason: "Trip postponed",
      includeLaterOccurrences: true,
    });

    expect(sent[0]?.body).toEqual({ cancellationReason: "Trip postponed", cancelSubsequentBookings: true });
    expect(updated?.uid).toBe("b2");
  });

  it("marks attendees as no-shows by the email Cal.diy stores", async () => {
    const { client, sent } = clientAnswering(answering(apiBooking(booking)));

    await markNoShow(client, "b1", [
      { email: "jane@example.com", noShow: true },
      { email: "sam@example.com", noShow: false },
    ]);

    expect(sent[0]).toMatchObject({
      path: "/api/v2/bookings/b1/mark-absent",
      version: "2024-08-13",
      body: {
        attendees: [
          { email: "jane@example.com", absent: true },
          { email: "sam@example.com", absent: false },
        ],
      },
    });
  });

  it("adds guests, leaving out blank names", async () => {
    const { client, sent } = clientAnswering(answering(apiBooking(booking)));

    await addGuests(client, "b1", [
      { email: " lee@example.com ", name: " Lee " },
      { email: "kim@example.com", name: " " },
    ]);

    expect(sent[0]).toMatchObject({
      path: "/api/v2/bookings/b1/guests",
      version: "2024-08-13",
      body: {
        guests: [
          { email: "lee@example.com", name: "Lee", language: "en" },
          { email: "kim@example.com", language: "en" },
        ],
      },
    });
  });

  it("passes API errors on, with the server's explanation", async () => {
    const { client } = clientAnswering(() =>
      jsonResponse({ statusCode: 400, message: "Cancellation reason is required" }, { status: 400 })
    );

    const error = await cancelBooking(client, "b1", { reason: "" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CalApiError);
    expect(error).toMatchObject({
      kind: "invalid_request",
      serverMessage: "Cancellation reason is required",
    });
  });
});
