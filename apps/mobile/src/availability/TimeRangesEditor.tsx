import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocales } from "expo-localization";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { useTheme } from "@/theme/useTheme";

import { clockTime } from "./hours-text";
import { TimePicker } from "./TimePicker";
import { nextRange, type TimeRange } from "./weekly-hours-form";

export type TimeRangesLabels = {
  /** The start and end pickers' labels, which name what the hours are for when that isn't the only thing. */
  start: string;
  end: string;
  /** The remove button's label, given the range written out, such as "9:00 AM – 5:00 PM". */
  remove: (range: string) => string;
  addHint: string;
};

type TimeRangesEditorProps = {
  ranges: TimeRange[];
  onChange: (ranges: TimeRange[]) => void;
  labels: TimeRangesLabels;
  disabled: boolean;
};

/** Ranges of time picked from start to end, with a button to remove each and one to add another. */
export function TimeRangesEditor({ ranges, onChange, labels, disabled }: TimeRangesEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const next = nextRange(ranges);

  function changeRange(index: number, range: TimeRange) {
    onChange(ranges.map((current, at) => (at === index ? range : current)));
  }

  return (
    <>
      {ranges.map((range, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a range has no identity beyond its place in the day
        <View key={index} style={styles.range}>
          <TimePicker
            label={labels.start}
            title={t("availability.hours.startTitle")}
            value={range.start}
            onChange={(start) => changeRange(index, { ...range, start })}
            disabled={disabled}
          />
          <Text style={[styles.dash, { color: colors.textMuted }]}>–</Text>
          <TimePicker
            label={labels.end}
            title={t("availability.hours.endTitle")}
            value={range.end}
            onChange={(end) => changeRange(index, { ...range, end })}
            disabled={disabled}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={labels.remove(
              t("availability.timeRange", {
                start: clockTime(range.start, locale),
                end: clockTime(range.end, locale),
              })
            )}
            disabled={disabled}
            onPress={() => onChange(ranges.filter((_, at) => at !== index))}
            style={({ pressed }) => [styles.remove, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}
      {ranges.length > 0 && next ? (
        <Button
          variant="secondary"
          label={t("availability.hours.add")}
          accessibilityHint={labels.addHint}
          disabled={disabled}
          onPress={() => onChange([...ranges, next])}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  range: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dash: {
    fontSize: 16,
  },
  remove: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
