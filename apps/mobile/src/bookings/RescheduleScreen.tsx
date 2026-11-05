import { addDays, endOfDay, startOfDay } from "date-fns";
import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { FilterTabs } from "@/components/FilterTabs";
import { FormScreen } from "@/components/FormScreen";
import { LoadErrorState } from "@/components/LoadErrorState";
import { TextField } from "@/components/TextField";
import { actionErrorMessage } from "@/lib/action-error";
import { useTheme } from "@/theme/useTheme";

import type { BookingDetail } from "./booking-detail";
import {
  dayKey,
  formatDayHeading,
  formatFullDate,
  formatShortDate,
  formatTime,
  formatTimeRange,
  timeZoneCity,
} from "./format";
import { useBooking } from "./useBooking";
import { useCloseBookingForm } from "./useCloseBookingForm";
import { type SlotWindow, useRescheduleBooking, useRescheduleSlots } from "./useReschedule";

/** How many days of free times to show at once. */
const WINDOW_DAYS = 14;

/** FormScreen's side padding, which the day tabs reach past to scroll edge to edge. */
const FORM_PADDING = 24;

function slotWindow(page: number, openedAt: Date): SlotWindow {
  const firstDay = addDays(startOfDay(openedAt), page * WINDOW_DAYS);
  return {
    // The first window starts now, so times already gone today aren't offered.
    from: page === 0 ? openedAt : firstDay,
    to: endOfDay(addDays(firstDay, WINDOW_DAYS - 1)),
  };
}

/** Start times grouped by the device's calendar day, in order. */
function startsByDay(starts: readonly string[]): Map<string, string[]> {
  const days = new Map<string, string[]>();
  for (const start of starts) {
    const key = dayKey(start);
    const dayStarts = days.get(key);
    if (dayStarts) dayStarts.push(start);
    else days.set(key, [start]);
  }
  return days;
}

function endOf(start: string, durationMinutes: number): string {
  return new Date(Date.parse(start) + durationMinutes * 60_000).toISOString();
}

function ReschedulePicker({ booking }: { booking: BookingDetail }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const close = useCloseBookingForm(booking.uid);
  const [{ languageTag: locale }] = useLocales();
  // Fixed when the picker opens, so the window (and the query key built from it) doesn't move on every render.
  const [openedAt] = useState(() => new Date());
  const [page, setPage] = useState(0);
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [chosenStart, setChosenStart] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const range = useMemo(() => slotWindow(page, openedAt), [page, openedAt]);
  const slots = useRescheduleSlots(booking, range);
  const reschedule = useRescheduleBooking(booking.uid);

  const days = useMemo(() => {
    // The booking's own time comes back as free, but moving it there would change nothing.
    const current = Date.parse(booking.start);
    return startsByDay((slots.data ?? []).filter((start) => Date.parse(start) !== current));
  }, [slots.data, booking.start]);
  const dayKeys = [...days.keys()];
  const day = chosenDay !== null && days.has(chosenDay) ? chosenDay : (dayKeys[0] ?? null);
  const dayStarts = day === null ? [] : (days.get(day) ?? []);
  const labels = {
    today: t("bookings.days.today"),
    tomorrow: t("bookings.days.tomorrow"),
    yesterday: t("bookings.days.yesterday"),
  };
  const dayOptions = dayKeys.map((key) => ({
    value: key,
    label: formatDayHeading(days.get(key)?.[0] ?? key, { locale, now: openedAt, labels }),
  }));
  const windowLabel = t("reschedule.window", {
    from: formatShortDate(range.from, locale),
    to: formatShortDate(range.to, locale),
  });
  const attendee = booking.attendees[0]?.name;
  const zone = timeZoneCity(Intl.DateTimeFormat().resolvedOptions().timeZone);

  function describe(start: string): string {
    return t("reschedule.slotLabel", {
      day: formatFullDate(start, locale),
      time: formatTimeRange(start, endOf(start, booking.durationMinutes), locale),
    });
  }

  function showPage(next: number) {
    setPage(next);
    setChosenDay(null);
  }

  function handleReschedule() {
    if (chosenStart === null) return;
    reschedule.mutate(
      { start: chosenStart, reason },
      {
        onSuccess: (newUid) => {
          AccessibilityInfo.announceForAccessibility(t("reschedule.done"));
          // Cal.diy books the new time as a new booking, which takes the original's place on screen, so going
          // back from it leads to the list rather than to the cancelled original.
          if (router.canGoBack()) router.back();
          router.replace({ pathname: "/booking/[uid]", params: { uid: newUid, notice: "rescheduled" } });
        },
      }
    );
  }

  let picker: ReactNode;
  if (slots.isPending) {
    picker = <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />;
  } else if (slots.isError) {
    picker = (
      <LoadErrorState
        error={slots.error}
        onRetry={() => void slots.refetch()}
        fallbackMessage={t("reschedule.loadFailed")}
      />
    );
  } else if (dayKeys.length === 0) {
    picker = (
      <Text style={[styles.body, { color: colors.textMuted }]}>
        {t("reschedule.noSlots", {
          from: formatShortDate(range.from, locale),
          to: formatShortDate(range.to, locale),
        })}
      </Text>
    );
  } else {
    picker = (
      <>
        <FilterTabs
          options={dayOptions}
          value={day ?? ""}
          onChange={setChosenDay}
          accessibilityLabel={t("reschedule.daysLabel")}
          containerPadding={FORM_PADDING}
        />
        <View style={styles.slots}>
          {dayStarts.map((start) => {
            const selected = start === chosenStart;
            return (
              <Pressable
                key={start}
                accessibilityRole="button"
                accessibilityLabel={describe(start)}
                accessibilityState={{ selected }}
                onPress={() => setChosenStart(start)}
                style={({ pressed }) => [
                  styles.slot,
                  {
                    backgroundColor: selected ? colors.accent : colors.surface,
                    borderColor: selected ? colors.accent : colors.inputBorder,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.slotText, { color: selected ? colors.onAccent : colors.text }]}>
                  {formatTime(start, locale)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  }

  return (
    <FormScreen
      title={t("reschedule.title")}
      description={
        attendee
          ? t("reschedule.description", { zone, name: attendee })
          : t("reschedule.descriptionNoName", { zone })
      }
    >
      <Text style={[styles.body, { color: colors.textMuted }]}>
        {t("reschedule.current", { time: describe(booking.start) })}
      </Text>
      <View style={styles.windowRow}>
        <View style={styles.windowButton}>
          <Button
            variant="secondary"
            label={t("reschedule.earlier")}
            disabled={page === 0}
            onPress={() => showPage(page - 1)}
          />
        </View>
        <View style={styles.windowButton}>
          <Button variant="secondary" label={t("reschedule.later")} onPress={() => showPage(page + 1)} />
        </View>
      </View>
      <Text accessibilityRole="header" style={[styles.windowLabel, { color: colors.text }]}>
        {windowLabel}
      </Text>
      {picker}
      {chosenStart !== null ? (
        <Text style={[styles.body, styles.strong, { color: colors.text }]}>
          {t("reschedule.selected", { time: describe(chosenStart) })}
        </Text>
      ) : null}
      <TextField
        label={t("reschedule.reasonLabel")}
        hint={t("reschedule.reasonHint")}
        value={reason}
        onChangeText={setReason}
        multiline
        textAlignVertical="top"
        editable={!reschedule.isPending}
      />
      {reschedule.isError ? (
        <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>
          {actionErrorMessage(t, reschedule.error, {
            fallback: t("reschedule.failed"),
            notFound: t("bookingDetail.notFound"),
          })}
        </Text>
      ) : null}
      <Button
        label={t("reschedule.submit")}
        loading={reschedule.isPending}
        disabled={chosenStart === null}
        onPress={handleReschedule}
      />
      <Button
        variant="secondary"
        label={t("bookingActions.goBack")}
        disabled={reschedule.isPending}
        onPress={close}
      />
    </FormScreen>
  );
}

export function RescheduleScreen({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const booking = useBooking(uid);

  if (booking.data) return <ReschedulePicker booking={booking.data} />;
  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      {booking.isError ? (
        <LoadErrorState
          error={booking.error}
          onRetry={() => void booking.refetch()}
          fallbackMessage={t("bookingDetail.loadFailed")}
          notFoundMessage={t("bookingDetail.notFound")}
        />
      ) : (
        <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  strong: {
    fontWeight: "600",
  },
  windowRow: {
    flexDirection: "row",
    gap: 12,
  },
  windowButton: {
    flex: 1,
  },
  windowLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
  slots: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  // 48 pt tall keeps each time an easy touch target.
  slot: {
    minHeight: 48,
    minWidth: 96,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  slotText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
