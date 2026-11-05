import { CalApiError } from "@janji/cal-api/errors";
import type { TFunction } from "i18next";

import { loadErrorMessage } from "@/components/LoadErrorState";

// Cal.diy's tRPC handlers reject with translation keys such as "you_do_not_have_permission" instead of
// sentences. A key means nothing to people, so only messages that read as text are shown.
function readableServerMessage(message: string | null): string | null {
  const trimmed = message?.trim();
  return trimmed && /\s/.test(trimmed) ? trimmed : null;
}

/** Explains why an action on a booking failed. `fallback` names the action, e.g. "Couldn't confirm the booking." */
export function actionErrorMessage(t: TFunction, error: unknown, fallback: string): string {
  if (error instanceof CalApiError) {
    if (error.kind === "not_found") return t("bookingDetail.notFound");
    if (error.kind === "invalid_request" || error.kind === "forbidden" || error.kind === "conflict") {
      const explanation = readableServerMessage(error.serverMessage);
      if (explanation) return t("bookingActions.serverSaid", { message: explanation });
    }
  }
  return loadErrorMessage(t, error) ?? fallback;
}
