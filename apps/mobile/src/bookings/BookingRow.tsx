import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

import type { BookingAttendee, BookingStatus, BookingSummary } from "./booking";
import { formatTimeRange } from "./format";

export function attendeesText(t: TFunction, attendees: readonly BookingAttendee[]): string | null {
  const [first, second] = attendees;
  if (!first) return null;
  if (attendees.length === 1) return t("bookings.attendeesOne", { name: first.name });
  if (attendees.length === 2 && second) {
    return t("bookings.attendeesTwo", { first: first.name, second: second.name });
  }
  return t("bookings.attendeesMore", { first: first.name, count: attendees.length - 1 });
}

/** Accepted is the normal case, so only the other statuses get a label. */
export function statusText(t: TFunction, status: BookingStatus): string | null {
  return status === "accepted" ? null : t(`bookings.status.${status}`);
}

type BookingRowProps = {
  booking: BookingSummary;
  /** BCP 47 locale for times, usually the device's. */
  locale: string;
};

export function BookingRow({ booking, locale }: BookingRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const time = formatTimeRange(booking.start, booking.end, locale);
  const attendees = attendeesText(t, booking.attendees);
  const status = statusText(t, booking.status);
  const details = [attendees, booking.isRecurring ? t("bookings.recurring") : null]
    .filter(Boolean)
    .join(" · ");
  const inactive = booking.status === "cancelled" || booking.status === "rejected";
  const statusColor = booking.status === "pending" ? colors.accent : colors.danger;

  return (
    <View
      accessible
      accessibilityLabel={[
        time,
        booking.title,
        attendees,
        booking.isRecurring ? t("bookings.recurring") : null,
        status,
      ]
        .filter(Boolean)
        .join(", ")}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.topLine}>
        <Text style={[styles.time, { color: inactive ? colors.textMuted : colors.text }]}>{time}</Text>
        {status ? (
          <Text style={[styles.status, { color: statusColor, borderColor: statusColor }]}>{status}</Text>
        ) : null}
      </View>
      <Text numberOfLines={2} style={[styles.title, { color: inactive ? colors.textMuted : colors.text }]}>
        {booking.title}
      </Text>
      {details ? <Text style={[styles.details, { color: colors.textMuted }]}>{details}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  time: {
    fontSize: 15,
    fontWeight: "600",
  },
  status: {
    fontSize: 13,
    fontWeight: "600",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
  },
  details: {
    fontSize: 14,
    lineHeight: 20,
  },
});
