import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { timeZoneCity } from "@/bookings/format";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { LoadErrorState } from "@/components/LoadErrorState";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Section } from "@/components/Section";
import { actionErrorMessage } from "@/lib/action-error";
import { calendarDateText } from "@/lib/calendar-date";
import { useTheme } from "@/theme/useTheme";

import { overrideHoursText, upcomingOverrideDays } from "./date-overrides";
import { weeklyHoursText } from "./hours-text";
import type { Schedule } from "./schedule";
import { useDeleteSchedule, useSchedule, useSetDefaultSchedule } from "./useSchedules";

function DefaultSection({ schedule }: { schedule: Schedule }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const setDefault = useSetDefaultSchedule();

  return (
    <Section title={t("availability.defaultTitle")}>
      {schedule.isDefault ? (
        <Text style={[styles.body, { color: colors.text }]}>{t("availability.isDefault")}</Text>
      ) : (
        <View style={styles.group}>
          <Text style={[styles.body, { color: colors.textMuted }]}>{t("availability.notDefault")}</Text>
          <Button
            variant="secondary"
            label={t("availability.makeDefault")}
            loading={setDefault.isPending}
            onPress={() =>
              setDefault.mutate(schedule.id, {
                onSuccess: () => AccessibilityInfo.announceForAccessibility(t("availability.madeDefault")),
              })
            }
          />
          {setDefault.isError ? (
            <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>
              {actionErrorMessage(t, setDefault.error, {
                fallback: t("availability.makeDefaultFailed"),
                notFound: t("availability.notFound"),
              })}
            </Text>
          ) : null}
        </View>
      )}
    </Section>
  );
}

function OverridesSection({ schedule }: { schedule: Schedule }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const router = useRouter();
  const days = upcomingOverrideDays(schedule.overrides, schedule.timeZone);
  const id = String(schedule.id);

  return (
    <Section title={t("availability.overrides.title")}>
      {days.length === 0 ? (
        <Text style={[styles.body, { color: colors.textMuted }]}>{t("availability.overrides.none")}</Text>
      ) : (
        days.map((day) => {
          const hours = overrideHoursText(t, day, locale);
          return (
            <Pressable
              key={day.date}
              accessibilityRole="button"
              accessibilityLabel={`${calendarDateText(day.date, locale, "long")}, ${hours}`}
              accessibilityHint={t("availability.overrides.editHint")}
              onPress={() =>
                router.push({ pathname: "/schedule/[id]/override/[date]", params: { id, date: day.date } })
              }
              style={({ pressed }) => [
                styles.override,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={styles.overrideText}>
                <Text style={[styles.overrideDate, { color: colors.text }]}>
                  {calendarDateText(day.date, locale)}
                </Text>
                <Text style={[styles.body, { color: colors.textMuted }]}>{hours}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          );
        })
      )}
      <View style={styles.sectionAction}>
        <Button
          variant="secondary"
          label={t("availability.overrides.add")}
          onPress={() => router.push({ pathname: "/schedule/[id]/override/new", params: { id } })}
        />
      </View>
    </Section>
  );
}

type DeleteAction = ReturnType<typeof useDeleteSchedule>;

function DeleteControls({ schedule, remove }: { schedule: Schedule; remove: DeleteAction }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  // Unlike the web app, API v2 deletes a default schedule without choosing another, which leaves the person
  // unbookable until they do; so the default can't be deleted here.
  if (schedule.isDefault) {
    return (
      <Text style={[styles.body, { color: colors.textMuted }]}>{t("availability.cantDeleteDefault")}</Text>
    );
  }

  function handleDelete() {
    remove.mutate(schedule.id, {
      onSuccess: () => {
        AccessibilityInfo.announceForAccessibility(t("availability.deleted"));
        if (router.canGoBack()) router.back();
        else router.replace("/availability");
      },
    });
  }

  return (
    <View style={styles.group}>
      {confirming ? (
        <>
          <Text style={[styles.body, { color: colors.text }]}>
            {t("availability.deleteQuestion", { name: schedule.name })}
          </Text>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                variant="destructive"
                label={t("availability.deleteConfirm")}
                loading={remove.isPending}
                onPress={handleDelete}
              />
            </View>
            <View style={styles.action}>
              <Button
                variant="secondary"
                label={t("availability.keep")}
                disabled={remove.isPending}
                onPress={() => setConfirming(false)}
              />
            </View>
          </View>
        </>
      ) : (
        <Button variant="destructive" label={t("availability.delete")} onPress={() => setConfirming(true)} />
      )}
      {remove.isError ? (
        <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>
          {actionErrorMessage(t, remove.error, {
            fallback: t("availability.deleteFailed"),
            notFound: t("availability.notFound"),
          })}
        </Text>
      ) : null}
    </View>
  );
}

export function ScheduleScreen({ id }: { id: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const router = useRouter();
  const schedule = useSchedule(id);
  const remove = useDeleteSchedule();

  if (schedule.isPending) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />
      </View>
    );
  }

  if (schedule.isLoadingError) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <LoadErrorState
          error={schedule.error}
          onRetry={() => void schedule.refetch()}
          fallbackMessage={t("availability.loadFailed")}
        />
      </View>
    );
  }

  const details = schedule.data;
  if (!details) {
    // Once this schedule is deleted, the screen closes; until then there's nothing to say.
    if (remove.isSuccess) return <View style={[styles.screen, { backgroundColor: colors.background }]} />;
    return (
      <View style={[styles.centered, styles.padded, { backgroundColor: colors.background }]}>
        <Text accessibilityRole="alert" style={[styles.message, { color: colors.text }]}>
          {t("availability.notFound")}
        </Text>
      </View>
    );
  }

  return (
    <ScreenScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.heading}>
        {details.isDefault ? (
          <View style={styles.badgeLine}>
            <Badge label={t("availability.default")} color={colors.accent} />
          </View>
        ) : null}
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {details.name}
        </Text>
      </View>
      <Section title={t("availability.weeklyHours")}>
        {weeklyHoursText(t, details.hours, locale).map((line) => (
          <Text key={line} style={[styles.body, { color: colors.text }]}>
            {line}
          </Text>
        ))}
        <View style={styles.sectionAction}>
          <Button
            variant="secondary"
            label={t("availability.hours.action")}
            onPress={() =>
              router.push({ pathname: "/schedule/[id]/hours", params: { id: String(details.id) } })
            }
          />
        </View>
      </Section>
      <OverridesSection schedule={details} />
      <Section title={t("availability.timeZone")}>
        <Text style={[styles.body, { color: colors.text }]}>
          {t("availability.timeZoneValue", { city: timeZoneCity(details.timeZone), zone: details.timeZone })}
        </Text>
        <View style={styles.sectionAction}>
          <Button
            variant="secondary"
            label={t("availability.details.action")}
            onPress={() =>
              router.push({ pathname: "/schedule/[id]/details", params: { id: String(details.id) } })
            }
          />
        </View>
      </Section>
      <DefaultSection schedule={details} />
      <DeleteControls schedule={details} remove={remove} />
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  padded: {
    padding: 24,
  },
  message: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  heading: {
    gap: 8,
  },
  badgeLine: {
    flexDirection: "row",
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  group: {
    gap: 12,
  },
  // 48 pt keeps each date an easy touch target.
  override: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  overrideText: {
    flex: 1,
    gap: 2,
  },
  overrideDate: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },
  sectionAction: {
    marginTop: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  action: {
    flex: 1,
  },
});
