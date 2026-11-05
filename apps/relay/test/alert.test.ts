import { describe, expect, it } from "vitest";

import { alertFor, dedupeKey } from "../src/alert";
import { readBookingWebhook } from "../src/webhook";
import { type WebhookOptions, webhookBody } from "./webhooks";

function webhook(options: WebhookOptions = {}) {
  const read = readBookingWebhook(webhookBody(options));
  if (!read || read === "other") throw new Error("Expected a booking webhook");
  return read;
}

describe("alertFor", () => {
  it.each([
    [{ trigger: "BOOKING_CREATED" }, "New booking"],
    [{ trigger: "BOOKING_CREATED", recurring: true }, "New recurring booking"],
    [{ trigger: "BOOKING_CREATED", requiresConfirmation: true }, "Booking confirmed"],
    [{ trigger: "BOOKING_REQUESTED", requiresConfirmation: true }, "Needs your confirmation"],
    [{ trigger: "BOOKING_REQUESTED", recurring: true }, "Recurring booking needs your confirmation"],
    [{ trigger: "BOOKING_RESCHEDULED" }, "Rescheduled"],
    [{ trigger: "BOOKING_CANCELLED" }, "Cancelled"],
  ])("titles %o as %s", (options, title) => {
    expect(alertFor(webhook(options), "en").title).toBe(title);
  });

  it("names the event, the start on the organizer's clock and the attendee, and links the booking", () => {
    // 07:00 UTC is 3:00 pm in Kuala Lumpur.
    expect(alertFor(webhook(), "en-GB")).toEqual({
      title: "New booking",
      body: "Consultation · Thu 12 Nov, 15:00 · Jane",
      data: { bookingUid: "booking-1" },
    });
    expect(alertFor(webhook({ attendee: null }), "en-US").body).toBe("Consultation · Thu, Nov 12, 3:00 PM");
  });

  it("still writes the alert for a locale the runtime doesn't know", () => {
    expect(alertFor(webhook(), "zz-ZZZZ").body).toContain("Consultation");
  });
});

describe("dedupeKey", () => {
  it("tells bookings and events apart", () => {
    expect(dedupeKey("device", webhook())).toBe("device:BOOKING_CREATED:booking-1");
    expect(dedupeKey("device", webhook({ uid: "booking-2" }))).not.toBe(dedupeKey("device", webhook()));
    expect(dedupeKey("device", webhook({ trigger: "BOOKING_CANCELLED" }))).not.toBe(
      dedupeKey("device", webhook())
    );
  });

  it("gives every booking in a recurring series the same key", () => {
    expect(dedupeKey("device", webhook({ recurring: true, uid: "occurrence-1" }))).toBe(
      dedupeKey("device", webhook({ recurring: true, uid: "occurrence-2" }))
    );
  });
});
