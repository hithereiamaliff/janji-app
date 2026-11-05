import Ionicons from "@expo/vector-icons/Ionicons";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

import type { BookingAttendee, BookingSummary } from "./booking";
import { formatTimeRange } from "./format";
import { StatusBadge, statusText } from "./StatusBadge";

export function attendeesText(t: TFunction, attendees: readonly BookingAttendee[]): string | null {
  const [first, second] = attendees;
  if (!first) return null;
  if (attendees.length === 1) return t("bookings.attendeesOne", { name: first.name });
  if (attendees.length === 2 && second) {
    return t("bookings.attendeesTwo", { first: first.name, second: second.name });
  }
  return t("bookings.attendeesMore", { first: first.name, count: attendees.length - 1 });
}

type BookingRowProps = {
  booking: BookingSummary;
  /** BCP 47 locale for times, usually the device's. */
  locale: string;
  onPress: () => void;
};

export function BookingRow({ booking, locale, onPress }: BookingRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const time = formatTimeRange(booking.start, booking.end, locale);
  const attendees = attendeesText(t, booking.attendees);
  const status = statusText(t, booking.status);
  const details = [attendees, booking.isRecurring ? t("bookings.recurring") : null]
    .filter(Boolean)
    .join(" · ");
  const inactive = booking.status === "cancelled" || booking.status === "rejected";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t("bookings.openHint")}
      accessibilityLabel={[
        time,
        booking.title,
        attendees,
        booking.isRecurring ? t("bookings.recurring") : null,
        status,
      ]
        .filter(Boolean)
        .join(", ")}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.topLine}>
          <Text style={[styles.time, { color: inactive ? colors.textMuted : colors.text }]}>{time}</Text>
          <StatusBadge status={booking.status} />
        </View>
        <Text numberOfLines={2} style={[styles.title, { color: inactive ? colors.textMuted : colors.text }]}>
          {booking.title}
        </Text>
        {details ? <Text style={[styles.details, { color: colors.textMuted }]}>{details}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  content: {
    flex: 1,
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
  title: {
    fontSize: 16,
    lineHeight: 22,
  },
  details: {
    fontSize: 14,
    lineHeight: 20,
  },
});
