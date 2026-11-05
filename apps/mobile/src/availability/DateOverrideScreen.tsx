import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { timeZoneCity } from "@/bookings/format";
import { Button } from "@/components/Button";
import { DateCalendar } from "@/components/DateCalendar";
import { FormScreen } from "@/components/FormScreen";
import { ThemedSwitch } from "@/components/ThemedSwitch";
import { actionErrorMessage } from "@/lib/action-error";
import { calendarDateText, todayIn } from "@/lib/calendar-date";
import { useProfile } from "@/profile/useProfile";
import { useTheme } from "@/theme/useTheme";

import { defaultOverrideRanges, overrideDays, withOverride, withoutOverride } from "./date-overrides";
import type { Schedule } from "./schedule";
import { TimeRangesEditor } from "./TimeRangesEditor";
import { useSchedule, useUpdateSchedule } from "./useSchedules";
import { checkRanges, type DayProblem, DEFAULT_RANGE, sortRanges, type TimeRange } from "./weekly-hours-form";

type FormProps = {
  schedule: Schedule;
  /** The date whose override is being changed. Without one, new overrides are added for dates picked. */
  date?: string;
  weekStart: number;
};

function DateOverrideForm({ schedule, date, weekStart }: FormProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const router = useRouter();
  const update = useUpdateSchedule(schedule.id);
  // As the form found it, so a refresh while it's open doesn't change what counts as edited.
  const [original] = useState(() => {
    const existing = overrideDays(schedule.overrides).find((day) => day.date === date);
    return {
      ranges: existing?.ranges ?? null,
      today: todayIn(schedule.timeZone),
      timeZone: schedule.timeZone,
      hours: schedule.hours,
    };
  });
  const [dates, setDates] = useState<string[]>(date ? [date] : []);
  const [unavailable, setUnavailable] = useState(original.ranges?.length === 0);
  const [ranges, setRanges] = useState<TimeRange[]>(() => {
    if (original.ranges && original.ranges.length > 0) return original.ranges;
    return date ? defaultOverrideRanges(original.hours, date) : [DEFAULT_RANGE];
  });
  // Until the hours are changed, they follow the first date picked, as on the web.
  const [rangesChanged, setRangesChanged] = useState(Boolean(date));
  const [problem, setProblem] = useState<DayProblem | "noDates" | null>(null);
  const [removing, setRemoving] = useState(false);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/schedule/[id]", params: { id: String(schedule.id) } });
  }

  function toggleDate(day: string) {
    const next = dates.includes(day) ? dates.filter((each) => each !== day) : [...dates, day];
    setDates(next);
    const first = next[0];
    if (!rangesChanged && first) setRanges(defaultOverrideRanges(original.hours, first));
  }

  function changeRanges(next: TimeRange[]) {
    setRangesChanged(true);
    // Removing the last range leaves no time, which is what unavailable all day means; the range stays in the
    // form, so switching back brings it back.
    if (next.length === 0) setUnavailable(true);
    else setRanges(next);
  }

  function save(overrides: Schedule["overrides"], announcement: string) {
    update.mutate(
      { overrides },
      {
        onSuccess: () => {
          AccessibilityInfo.announceForAccessibility(announcement);
          close();
        },
      }
    );
  }

  function handleSave() {
    if (dates.length === 0) {
      setProblem("noDates");
      return;
    }
    const chosen = unavailable ? [] : ranges;
    const found = checkRanges(chosen);
    setProblem(found);
    if (found) return;
    if (original.ranges && JSON.stringify(sortRanges(chosen)) === JSON.stringify(original.ranges)) {
      close();
      return;
    }
    setRemoving(false);
    // Built on the schedule as it is now, so another date changed meanwhile on the web isn't undone.
    save(withOverride(schedule.overrides, dates, chosen), t("availability.overrides.saved"));
  }

  function handleRemove() {
    if (!date) return;
    setRemoving(true);
    save(withoutOverride(schedule.overrides, date), t("availability.overrides.removed"));
  }

  const city = timeZoneCity(original.timeZone);
  const taken = new Set(overrideDays(schedule.overrides).map((day) => day.date));

  return (
    <FormScreen
      title={date ? calendarDateText(date, locale) : t("availability.overrides.addTitle")}
      description={t("availability.overrides.description", { city })}
    >
      {date ? null : (
        <View style={styles.group}>
          <DateCalendar
            selected={dates}
            onPress={toggleDate}
            today={original.today}
            minDate={original.today}
            disabledDates={[...taken]}
            weekStart={weekStart}
            disabled={update.isPending}
          />
          {problem === "noDates" ? (
            <Text accessibilityRole="alert" style={[styles.note, { color: colors.danger }]}>
              {t("availability.overrides.noDates")}
            </Text>
          ) : null}
        </View>
      )}
      <View style={[styles.switchRow, { borderColor: colors.border }]}>
        <Text style={[styles.switchLabel, { color: colors.text }]}>
          {t("availability.overrides.unavailable")}
        </Text>
        <ThemedSwitch
          accessibilityLabel={t("availability.overrides.unavailable")}
          value={unavailable}
          onValueChange={setUnavailable}
          disabled={update.isPending}
        />
      </View>
      {unavailable ? null : (
        <View style={styles.group}>
          <TimeRangesEditor
            ranges={ranges}
            onChange={changeRanges}
            labels={{
              start: t("availability.overrides.start"),
              end: t("availability.overrides.end"),
              remove: (range) => t("availability.overrides.removeRange", { range }),
              addHint: t("availability.overrides.addHint"),
            }}
            disabled={update.isPending}
          />
          {problem && problem !== "noDates" ? (
            <Text accessibilityRole="alert" style={[styles.note, { color: colors.danger }]}>
              {t(`availability.hours.problems.${problem}`)}
            </Text>
          ) : null}
        </View>
      )}
      {update.isError ? (
        <Text accessibilityRole="alert" style={[styles.note, { color: colors.danger }]}>
          {actionErrorMessage(t, update.error, {
            fallback: t(removing ? "availability.overrides.removeFailed" : "availability.overrides.failed"),
            notFound: t("availability.notFound"),
          })}
        </Text>
      ) : null}
      <Button
        label={t("availability.overrides.save")}
        loading={update.isPending && !removing}
        disabled={update.isPending}
        onPress={handleSave}
      />
      {date && original.ranges ? (
        <Button
          variant="destructive"
          label={t("availability.overrides.remove")}
          accessibilityHint={t("availability.overrides.removeHint")}
          loading={update.isPending && removing}
          disabled={update.isPending}
          onPress={handleRemove}
        />
      ) : null}
      <Button
        variant="secondary"
        label={t("bookingActions.goBack")}
        disabled={update.isPending}
        onPress={close}
      />
    </FormScreen>
  );
}

/**
 * Sets a date's hours on a schedule in place of the weekly ones, or removes that override. Without a date,
 * it adds overrides for the dates picked from a calendar.
 */
export function DateOverrideScreen({ id, date }: { id: number; date?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const schedule = useSchedule(id);
  const profile = useProfile();
  // Adding shows a calendar, which waits for the profile so its weeks don't jump to another first day. If the
  // profile can't be read, weeks start on Sunday, Cal.diy's default.
  if (schedule.data && (date || !profile.isPending)) {
    return <DateOverrideForm schedule={schedule.data} date={date} weekStart={profile.data?.weekStart ?? 0} />;
  }
  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      {schedule.isPending || profile.isPending ? (
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
  group: {
    gap: 10,
  },
  // 48 pt keeps the switch's row an easy touch target.
  switchRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 12,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
  },
});
