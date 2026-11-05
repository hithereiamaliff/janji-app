import "@/i18n";

import { CalApiError } from "@janji/cal-api/errors";
import { t } from "i18next";
import en from "@/i18n/locales/en.json";
import { actionErrorMessage } from "@/lib/action-error";

const fallback = "Couldn't confirm the booking. Try again.";
const messages = { fallback, notFound: en.bookingDetail.notFound };

describe("actionErrorMessage", () => {
  it("quotes the server's explanation of a rejected action", () => {
    const error = new CalApiError({
      kind: "invalid_request",
      status: 400,
      serverMessage: "Cannot cancel a booking that has already ended",
    });

    expect(actionErrorMessage(t, error, messages)).toBe(
      "Your Cal.diy server said: “Cannot cancel a booking that has already ended”"
    );
  });

  it("leaves out translation keys the server sends instead of explanations", () => {
    const error = new CalApiError({
      kind: "forbidden",
      status: 403,
      serverMessage: "you_do_not_have_permission",
    });

    expect(actionErrorMessage(t, error, messages)).toBe(fallback);
  });

  it("says when what the action was for no longer exists", () => {
    expect(actionErrorMessage(t, new CalApiError({ kind: "not_found", status: 404 }), messages)).toBe(
      en.bookingDetail.notFound
    );
  });

  it("uses the shared messages for connection, key and server problems", () => {
    expect(actionErrorMessage(t, new CalApiError({ kind: "network" }), messages)).toBe(en.loadErrors.network);
  });

  it("falls back to naming the action", () => {
    expect(actionErrorMessage(t, new Error("Unexpected"), messages)).toBe(fallback);
  });
});
