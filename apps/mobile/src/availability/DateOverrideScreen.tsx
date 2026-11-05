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
import { calendarDateText } from "@/lib/calendar-date";
import { useTheme } from "@/theme/useTheme";

import { defaultOverrideRanges, overrideDays, withOverride, withoutOverride } from "./date-overrides";
import type { Schedule } from "./schedule";
import { TimeRangesEditor } from "./TimeRangesEditor";
import { useSchedule, useUpdateSchedule } from "./useSchedules";
import { checkRanges, type DayProblem, sortRanges, type TimeRange } from "./weekly-hours-form";

type FormProps = {
  schedule: Schedule;
  /** The date ("YYYY-MM-DD") whose hours are being set. */
  date: string;
};

function DateOverrideForm({ schedule, date }: FormProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const router = useRouter();
  const update = useUpdateSchedule(schedule.id);
  // As the form found it, so a refresh while it's open doesn't change what counts as edited.
  const [original] = useState(() => ({
    ranges: overrideDays(schedule.overrides).find((day) => day.date === date)?.ranges ?? null,
    timeZone: schedule.timeZone,
    hours: schedule.hours,
  }));
  const [unavailable, setUnavailable] = useState(original.ranges?.length === 0);
  const [ranges, setRanges] = useState<TimeRange[]>(() =>
    original.ranges && original.ranges.length > 0
      ? original.ranges
      : defaultOverrideRanges(original.hours, date)
  );
  const [problem, setProblem] = useState<DayProblem | null>(null);
  const [removing, setRemoving] = useState(false);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/schedule/[id]", params: { id: String(schedule.id) } });
  }

  function changeRanges(next: TimeRange[]) {
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
    save(withOverride(schedule.overrides, [date], chosen), t("availability.overrides.saved"));
  }

  function handleRemove() {
    setRemoving(true);
    save(withoutOverride(schedule.overrides, date), t("availability.overrides.removed"));
  }

  return (
    <FormScreen
      title={calendarDateText(date, locale)}
      description={t("availability.overrides.description", { city: timeZoneCity(original.timeZone) })}
    >
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
          {problem ? (
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
      {original.ranges ? (
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

/** Sets a date's hours on a schedule in place of the weekly ones, or removes that override. */
export function DateOverrideScreen({ id, date }: { id: number; date: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const schedule = useSchedule(id);

  if (schedule.data) return <DateOverrideForm schedule={schedule.data} date={date} />;
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
