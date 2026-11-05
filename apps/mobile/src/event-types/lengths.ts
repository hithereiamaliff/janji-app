import type { TFunction } from "i18next";

import { formatDuration } from "@/lib/duration";

import type { EventTypeSummary } from "./event-type";

/** "3 hr", or every length on offer: "15 min, 30 min, 1 hr". */
export function lengthsText(t: TFunction, eventType: EventTypeSummary): string {
  const lengths = eventType.lengthOptions.length > 0 ? eventType.lengthOptions : [eventType.lengthInMinutes];
  return lengths.map((minutes) => formatDuration(t, minutes)).join(", ");
}

/** The lengths on offer, saying which one a booking gets unless the booker picks another. */
export function lengthDetails(t: TFunction, eventType: EventTypeSummary): string {
  if (eventType.lengthOptions.length === 0) return formatDuration(t, eventType.lengthInMinutes);
  return t("eventTypes.lengthChoice", {
    lengths: lengthsText(t, eventType),
    usual: formatDuration(t, eventType.lengthInMinutes),
  });
}
