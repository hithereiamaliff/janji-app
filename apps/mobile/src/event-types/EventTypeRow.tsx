import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge } from "@/components/Badge";
import { useTheme } from "@/theme/useTheme";

import type { EventTypeSummary } from "./event-type";
import { lengthsText } from "./lengths";

type EventTypeRowProps = {
  eventType: EventTypeSummary;
  /** Its booking page's address without the scheme, e.g. "book.example.com/alan/30min". */
  link: string;
  onPress: () => void;
};

export function EventTypeRow({ eventType, link, onPress }: EventTypeRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lengths = lengthsText(t, eventType);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t("eventTypes.openHint")}
      accessibilityLabel={[eventType.title, lengths, eventType.hidden ? t("eventTypes.hidden") : null]
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
            {eventType.title}
          </Text>
          {eventType.hidden ? <Badge label={t("eventTypes.hidden")} color={colors.textMuted} /> : null}
        </View>
        <Text style={[styles.details, { color: colors.textMuted }]}>{lengths}</Text>
        <Text numberOfLines={1} style={[styles.details, { color: colors.textMuted }]}>
          {link}
        </Text>
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
