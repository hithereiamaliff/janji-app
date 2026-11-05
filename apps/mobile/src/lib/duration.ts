import type { TFunction } from "i18next";

/** "30 min", "1 hr" or "1 hr 30 min". */
export function formatDuration(t: TFunction, minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return t("duration.minutes", { count: rest });
  if (rest === 0) return t("duration.hours", { count: hours });
  return t("duration.hoursMinutes", { hours, minutes: rest });
}
