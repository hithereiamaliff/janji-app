import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocales } from "expo-localization";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";

import {
  addMonths,
  type CalendarMonth,
  calendarDateText,
  compareMonths,
  dayOfMonthText,
  monthOf,
  monthTitle,
  monthWeeks,
  weekdayNames,
} from "@/lib/calendar-date";
import { useTheme } from "@/theme/useTheme";

type DateCalendarProps = {
  /** The picked dates, as "YYYY-MM-DD". */
  selected: readonly string[];
  onPress: (date: string) => void;
  /** Today on the clock the dates are on. It's marked, and its month opens first when nothing is picked. */
  today: string;
  /** The first date that can be picked. Earlier ones show but can't be, and earlier months aren't offered. */
  minDate?: string;
  /** Other dates that can't be picked. */
  disabledDates?: readonly string[];
  /** 0 for Sunday to 6 for Saturday. */
  weekStart: number;
  disabled?: boolean;
};

/** A month of dates to pick from, a month at a time. */
export function DateCalendar({
  selected,
  onPress,
  today,
  minDate,
  disabledDates = [],
  weekStart,
  disabled = false,
}: DateCalendarProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const [month, setMonth] = useState<CalendarMonth>(() => monthOf(selected[0] ?? today));
  const weekdays = useMemo(() => weekdayNames(weekStart, locale), [weekStart, locale]);
  // Labels are worked out once per month shown, rather than for every day on every render.
  const weeks = useMemo(
    () =>
      monthWeeks(month, weekStart).map((week) =>
        week.map((date) =>
          date
            ? { date, number: dayOfMonthText(date, locale), label: calendarDateText(date, locale, "long") }
            : null
        )
      ),
    [month, weekStart, locale]
  );
  const picked = new Set(selected);
  const blocked = new Set(disabledDates);
  const atFirstMonth = minDate !== undefined && compareMonths(month, monthOf(minDate)) <= 0;

  function show(next: CalendarMonth) {
    setMonth(next);
    AccessibilityInfo.announceForAccessibility(monthTitle(next, locale));
  }

  function navButton(direction: "previous" | "next") {
    const off = disabled || (direction === "previous" && atFirstMonth);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(direction === "previous" ? "calendar.previousMonth" : "calendar.nextMonth")}
        accessibilityState={{ disabled: off }}
        disabled={off}
        onPress={() => show(addMonths(month, direction === "previous" ? -1 : 1))}
        style={({ pressed }) => [styles.nav, { opacity: off ? 0.35 : pressed ? 0.6 : 1 }]}
      >
        <Ionicons
          name={direction === "previous" ? "chevron-back" : "chevron-forward"}
          size={22}
          color={colors.text}
        />
      </Pressable>
    );
  }

  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        {navButton("previous")}
        <Text style={[styles.month, { color: colors.text }]}>{monthTitle(month, locale)}</Text>
        {navButton("next")}
      </View>
      {/* Each date's own label names its weekday, so screen readers skip these column headings. */}
      <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {weekdays.map((name, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a column's place is what identifies it
          <Text key={index} numberOfLines={1} style={[styles.weekday, { color: colors.textMuted }]}>
            {name}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week.find((day) => day !== null)?.date} style={styles.week}>
          {week.map((day, index) => {
            // biome-ignore lint/suspicious/noArrayIndexKey: empty days have nothing but their place
            if (!day) return <View key={index} style={styles.cell} />;
            const isPicked = picked.has(day.date);
            const isToday = day.date === today;
            const off = disabled || (minDate !== undefined && day.date < minDate) || blocked.has(day.date);
            return (
              <Pressable
                key={day.date}
                accessibilityRole="button"
                accessibilityLabel={isToday ? t("calendar.today", { date: day.label }) : day.label}
                accessibilityState={{ selected: isPicked, disabled: off }}
                disabled={off}
                onPress={() => onPress(day.date)}
                style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View
                  style={[
                    styles.day,
                    isPicked
                      ? { backgroundColor: colors.accent }
                      : isToday
                        ? { borderWidth: 1.5, borderColor: colors.accent }
                        : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.number,
                      { color: isPicked ? colors.onAccent : off ? colors.textMuted : colors.text },
                      off && !isPicked ? styles.off : null,
                    ]}
                  >
                    {day.number}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: {
    gap: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // 48 pt keeps the month buttons easy to reach.
  nav: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  month: {
    fontSize: 17,
    fontWeight: "600",
  },
  week: {
    flexDirection: "row",
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    paddingVertical: 4,
  },
  // Seven to a row leaves about 46 pt each on a small phone, close to the 48 pt target.
  cell: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  day: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  number: {
    fontSize: 16,
  },
  off: {
    opacity: 0.55,
  },
});
