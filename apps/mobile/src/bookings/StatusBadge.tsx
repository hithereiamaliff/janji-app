import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/Badge";
import { useTheme } from "@/theme/useTheme";

import type { BookingStatus } from "./booking";

/** Accepted is the normal case, so only the other statuses get a label. */
export function statusText(t: TFunction, status: BookingStatus): string | null {
  return status === "accepted" ? null : t(`bookings.status.${status}`);
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const label = statusText(t, status);
  if (!label) return null;
  return <Badge label={label} color={status === "pending" ? colors.accent : colors.danger} />;
}
