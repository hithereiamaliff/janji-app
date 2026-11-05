import { CalApiError } from "@janji/cal-api/errors";
import type { TFunction } from "i18next";

import { loadErrorMessage } from "@/components/LoadErrorState";

// Cal.diy's tRPC handlers reject with translation keys such as "you_do_not_have_permission" instead of
// sentences. A key means nothing to people, so only messages that read as text are shown.
function readableServerMessage(message: string | null): string | null {
  const trimmed = message?.trim();
  return trimmed && /\s/.test(trimmed) ? trimmed : null;
}

export type ActionErrorMessages = {
  /** Names the action, e.g. "Couldn't confirm the booking. Try again." */
  fallback: string;
  /** Says that what the action was for, a booking or an event type, no longer exists. */
  notFound: string;
};

/** Explains why an action, such as confirming a booking or hiding an event type, failed. */
export function actionErrorMessage(
  t: TFunction,
  error: unknown,
  { fallback, notFound }: ActionErrorMessages
): string {
  if (error instanceof CalApiError) {
    if (error.kind === "not_found") return notFound;
    if (error.kind === "invalid_request" || error.kind === "forbidden" || error.kind === "conflict") {
      const explanation = readableServerMessage(error.serverMessage);
      if (explanation) return t("bookingActions.serverSaid", { message: explanation });
    }
  }
  return loadErrorMessage(t, error) ?? fallback;
}
