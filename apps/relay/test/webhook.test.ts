import { describe, expect, it } from "vitest";

import { isFresh, readBookingWebhook, verifySignature } from "../src/webhook";
import { signature, webhookBody } from "./webhooks";

describe("verifySignature", () => {
  it("accepts the body's HMAC with the secret, and nothing else", async () => {
    const body = webhookBody();
    const good = await signature("secret", body);

    expect(await verifySignature("secret", body, good)).toBe(true);
    expect(await verifySignature("secret", body, good.toUpperCase())).toBe(true);
    expect(await verifySignature("other", body, good)).toBe(false);
    expect(await verifySignature("secret", `${body} `, good)).toBe(false);
    expect(await verifySignature("secret", body, "no-secret-provided")).toBe(false);
    expect(await verifySignature("secret", body, "")).toBe(false);
  });
});

describe("isFresh", () => {
  const now = Date.parse("2026-11-05T09:00:00Z");

  it("takes webhooks from the last ten minutes, and a clock a little ahead", () => {
    expect(isFresh(now - 9 * 60_000, now)).toBe(true);
    expect(isFresh(now + 60_000, now)).toBe(true);
    expect(isFresh(now - 11 * 60_000, now)).toBe(false);
    expect(isFresh(now + 11 * 60_000, now)).toBe(false);
  });
});

describe("readBookingWebhook", () => {
  it("keeps only what an alert needs", () => {
    expect(readBookingWebhook(webhookBody({ createdAt: "2026-11-05T09:00:00.000Z" }))).toEqual({
      trigger: "BOOKING_CREATED",
      createdAt: Date.parse("2026-11-05T09:00:00.000Z"),
      uid: "booking-1",
      eventTitle: "Consultation",
      start: "2026-11-12T07:00:00.000Z",
      timeZone: "Asia/Kuala_Lumpur",
      attendeeName: "Jane",
      requiresConfirmation: false,
      recurring: false,
      rescheduledFrom: null,
    });
  });

  it("notes the booking a reschedule replaces", () => {
    const moved = webhookBody({
      trigger: "BOOKING_RESCHEDULED",
      uid: "booking-2",
      rescheduleUid: "booking-1",
    });

    expect(readBookingWebhook(moved)).toMatchObject({ uid: "booking-2", rescheduledFrom: "booking-1" });
    expect(readBookingWebhook(webhookBody({ rescheduleUid: "booking-1" }))).toMatchObject({
      rescheduledFrom: null,
    });
  });

  it("notes a recurring booking and one that needed confirming", () => {
    expect(readBookingWebhook(webhookBody({ recurring: true, requiresConfirmation: true }))).toMatchObject({
      recurring: true,
      requiresConfirmation: true,
    });
  });

  it("falls back to the booking's title and copes without attendees", () => {
    const body = JSON.parse(webhookBody({ attendee: null }));
    delete body.payload.eventTitle;

    expect(readBookingWebhook(JSON.stringify(body))).toMatchObject({
      eventTitle: "Consultation between Alan and Jane",
      attendeeName: null,
    });
  });

  it("sets aside webhooks about other things", () => {
    expect(readBookingWebhook(webhookBody({ trigger: "MEETING_ENDED" }))).toBe("other");
  });

  it.each([
    ["not JSON", "{"],
    ["no payload", JSON.stringify({ triggerEvent: "BOOKING_CREATED", createdAt: "2026-11-05T09:00:00Z" })],
    ["no date", webhookBody({ createdAt: "soon" })],
    ["no booking uid", webhookBody({ uid: "" })],
  ])("refuses a body with %s", (_, body) => {
    expect(readBookingWebhook(body)).toBeNull();
  });
});
