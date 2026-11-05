import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocales } from "expo-localization";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { timeZoneCity } from "@/bookings/format";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/theme/useTheme";

import { weeklyHoursText } from "./hours-text";
import type { Schedule } from "./schedule";

export function ScheduleRow({ schedule, onPress }: { schedule: Schedule; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const hours = weeklyHoursText(t, schedule.hours, locale);
  const zone = t("availability.zoneLine", { city: timeZoneCity(schedule.timeZone) });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t("availability.openHint")}
      accessibilityLabel={[
        schedule.name,
        schedule.isDefault ? t("availability.default") : null,
        ...hours,
        zone,
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
          <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>
            {schedule.name}
          </Text>
          {schedule.isDefault ? <Badge label={t("availability.default")} color={colors.accent} /> : null}
        </View>
        {hours.map((line) => (
          <Text key={line} style={[styles.details, { color: colors.textMuted }]}>
            {line}
          </Text>
        ))}
        <Text style={[styles.details, { color: colors.textMuted }]}>{zone}</Text>
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  details: {
    fontSize: 14,
    lineHeight: 20,
  },
});
