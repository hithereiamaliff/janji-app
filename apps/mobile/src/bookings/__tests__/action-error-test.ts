import "@/i18n";

import { CalApiError } from "@janji/cal-api/errors";
import { t } from "i18next";

import { actionErrorMessage } from "@/bookings/action-error";
import en from "@/i18n/locales/en.json";

const fallback = "Couldn't confirm the booking. Try again.";

describe("actionErrorMessage", () => {
  it("quotes the server's explanation of a rejected action", () => {
    const error = new CalApiError({
      kind: "invalid_request",
      status: 400,
      serverMessage: "Cannot cancel a booking that has already ended",
    });

    expect(actionErrorMessage(t, error, fallback)).toBe(
      "Your Cal.diy server said: “Cannot cancel a booking that has already ended”"
    );
  });

  it("leaves out translation keys the server sends instead of explanations", () => {
    const error = new CalApiError({
      kind: "forbidden",
      status: 403,
      serverMessage: "you_do_not_have_permission",
    });

    expect(actionErrorMessage(t, error, fallback)).toBe(fallback);
  });

  it("says when the booking no longer exists", () => {
    expect(actionErrorMessage(t, new CalApiError({ kind: "not_found", status: 404 }), fallback)).toBe(
      en.bookingDetail.notFound
    );
  });

  it("uses the shared messages for connection, key and server problems", () => {
    expect(actionErrorMessage(t, new CalApiError({ kind: "network" }), fallback)).toBe(en.loadErrors.network);
  });

  it("falls back to naming the action", () => {
    expect(actionErrorMessage(t, new Error("Unexpected"), fallback)).toBe(fallback);
  });
});
