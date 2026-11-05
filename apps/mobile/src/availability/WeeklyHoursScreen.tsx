import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { timeZoneCity } from "@/bookings/format";
import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { ThemedSwitch } from "@/components/ThemedSwitch";
import { actionErrorMessage } from "@/lib/action-error";
import { useTheme } from "@/theme/useTheme";

import { weekdayName } from "./hours-text";
import { type Schedule, WEEK_DAYS, type WeekDay } from "./schedule";
import { TimeRangesEditor } from "./TimeRangesEditor";
import { useSchedule, useUpdateSchedule } from "./useSchedules";
import {
  checkDayRanges,
  type DayProblem,
  type DayRanges,
  DEFAULT_RANGE,
  fromDayRanges,
  type TimeRange,
  toDayRanges,
} from "./weekly-hours-form";

type DayEditorProps = {
  day: WeekDay;
  ranges: TimeRange[];
  problem: DayProblem | undefined;
  onOpenChange: (open: boolean) => void;
  onChange: (ranges: TimeRange[]) => void;
  disabled: boolean;
};

function DayEditor({ day, ranges, problem, onOpenChange, onChange, disabled }: DayEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const name = weekdayName(day, locale);

  return (
    <View style={[styles.day, { borderColor: colors.border }]}>
      <View style={styles.dayHeader}>
        <Text style={[styles.dayName, { color: colors.text }]}>{name}</Text>
        <ThemedSwitch
          accessibilityLabel={t("availability.hours.openOn", { day: name })}
          value={ranges.length > 0}
          onValueChange={onOpenChange}
          disabled={disabled}
        />
      </View>
      {ranges.length === 0 ? (
        <Text style={[styles.note, { color: colors.textMuted }]}>{t("availability.hours.unavailable")}</Text>
      ) : (
        <TimeRangesEditor
          ranges={ranges}
          onChange={onChange}
          labels={{
            start: t("availability.hours.startOf", { day: name }),
            end: t("availability.hours.endOf", { day: name }),
            remove: (range) => t("availability.hours.remove", { day: name, range }),
            addHint: t("availability.hours.addHint", { day: name }),
          }}
          disabled={disabled}
        />
      )}
      {problem ? (
        <Text accessibilityRole="alert" style={[styles.note, { color: colors.danger }]}>
          {t(`availability.hours.problems.${problem}`)}
        </Text>
      ) : null}
    </View>
  );
}

function WeeklyHoursForm({ schedule }: { schedule: Schedule }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const update = useUpdateSchedule(schedule.id);
  // As the form found it, so a refresh while it's open doesn't change what counts as edited.
  const [original] = useState(schedule);
  const [week, setWeek] = useState<DayRanges>(() => toDayRanges(original.hours));
  // A day switched off keeps its hours here, so switching it back on brings them back.
  const [putAside, setPutAside] = useState<Partial<DayRanges>>({});
  const [problems, setProblems] = useState<Partial<Record<WeekDay, DayProblem>>>({});

  function setDay(day: WeekDay, ranges: TimeRange[]) {
    setWeek((current) => ({ ...current, [day]: ranges }));
  }

  function setOpen(day: WeekDay, open: boolean) {
    if (open) {
      const kept = putAside[day];
      setDay(day, kept && kept.length > 0 ? kept : [DEFAULT_RANGE]);
    } else {
      setPutAside((current) => ({ ...current, [day]: week[day] }));
      setDay(day, []);
    }
  }

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/schedule/[id]", params: { id: String(original.id) } });
  }

  function handleSave() {
    const found = checkDayRanges(week);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    const hours = fromDayRanges(week);
    if (JSON.stringify(hours) === JSON.stringify(fromDayRanges(toDayRanges(original.hours)))) {
      close();
      return;
    }
    update.mutate(
      { hours },
      {
        onSuccess: () => {
          AccessibilityInfo.announceForAccessibility(t("availability.hours.saved"));
          close();
        },
      }
    );
  }

  return (
    <FormScreen
      title={t("availability.hours.title")}
      description={t("availability.hours.description", { city: timeZoneCity(original.timeZone) })}
    >
      {WEEK_DAYS.map((day) => (
        <DayEditor
          key={day}
          day={day}
          ranges={week[day]}
          problem={problems[day]}
          onOpenChange={(open) => setOpen(day, open)}
          onChange={(ranges) => setDay(day, ranges)}
          disabled={update.isPending}
        />
      ))}
      {update.isError ? (
        <Text accessibilityRole="alert" style={[styles.note, { color: colors.danger }]}>
          {actionErrorMessage(t, update.error, {
            fallback: t("availability.hours.failed"),
            notFound: t("availability.notFound"),
          })}
        </Text>
      ) : null}
      <Button label={t("availability.hours.save")} loading={update.isPending} onPress={handleSave} />
      <Button
        variant="secondary"
        label={t("bookingActions.goBack")}
        disabled={update.isPending}
        onPress={close}
      />
    </FormScreen>
  );
}

export function WeeklyHoursScreen({ id }: { id: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const schedule = useSchedule(id);

  if (schedule.data) return <WeeklyHoursForm schedule={schedule.data} />;
  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      {schedule.isPending ? (
        <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />
      ) : (
        <Text accessibilityRole="alert" style={[styles.note, { color: colors.text }]}>
          {schedule.isError ? t("availability.loadFailed") : t("availability.notFound")}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  day: {
    borderBottomWidth: 1,
    paddingBottom: 16,
    gap: 10,
  },
  // 48 pt keeps the switch's row an easy touch target.
  dayHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayName: {
    fontSize: 16,
    fontWeight: "600",
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
  },
});
