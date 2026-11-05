import type { TFunction } from "i18next";

import type { PrivateLink } from "./private-links";

/** How long a link keeps working, or why it no longer does. */
export function linkStatus(t: TFunction, link: PrivateLink, locale: string): string {
  if (link.limit.kind === "date") {
    const end = new Date(link.limit.expiresAt);
    const parts = {
      date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(end),
      time: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(end),
    };
    return link.expired ? t("privateLinks.ended", parts) : t("privateLinks.worksUntil", parts);
  }
  const { used, max } = link.limit;
  if (link.expired) return t("privateLinks.usedUp", { count: max });
  return t("privateLinks.bookingsLeft", { count: max, left: Math.max(max - used, 0) });
}
