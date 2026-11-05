import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { TextField } from "@/components/TextField";
import { actionErrorMessage } from "@/lib/action-error";
import { useTheme } from "@/theme/useTheme";

import type { Schedule } from "./schedule";
import type { ScheduleChanges } from "./schedules-api";
import { TimeZonePicker } from "./TimeZonePicker";
import { useSchedule, useUpdateSchedule } from "./useSchedules";

function ScheduleDetailsForm({ schedule }: { schedule: Schedule }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const update = useUpdateSchedule(schedule.id);
  // As the form found it, so a refresh while it's open doesn't change what counts as edited.
  const [original] = useState(schedule);
  const [name, setName] = useState(original.name);
  const [timeZone, setTimeZone] = useState(original.timeZone);
  const [nameMissing, setNameMissing] = useState(false);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/schedule/[id]", params: { id: String(original.id) } });
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameMissing(true);
      return;
    }
    setNameMissing(false);
    const changes: ScheduleChanges = {};
    if (trimmed !== original.name) changes.name = trimmed;
    if (timeZone !== original.timeZone) changes.timeZone = timeZone;
    if (Object.keys(changes).length === 0) {
      close();
      return;
    }
    update.mutate(changes, {
      onSuccess: () => {
        AccessibilityInfo.announceForAccessibility(t("availability.details.saved"));
        close();
      },
    });
  }

  return (
    <FormScreen title={t("availability.details.title")}>
      <TextField
        label={t("availability.details.nameLabel")}
        value={name}
        onChangeText={setName}
        error={nameMissing ? t("availability.new.nameMissing") : null}
        editable={!update.isPending}
      />
      <View style={styles.group}>
        <Text style={[styles.label, { color: colors.text }]}>{t("availability.details.timeZoneLabel")}</Text>
        <TimeZonePicker value={timeZone} onChange={setTimeZone} disabled={update.isPending} />
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t("availability.details.timeZoneHint")}
        </Text>
      </View>
      {update.isError ? (
        <Text accessibilityRole="alert" style={[styles.hint, { color: colors.danger }]}>
          {actionErrorMessage(t, update.error, {
            fallback: t("availability.details.failed"),
            notFound: t("availability.notFound"),
          })}
        </Text>
      ) : null}
      <Button label={t("availability.details.save")} loading={update.isPending} onPress={handleSave} />
      <Button
        variant="secondary"
        label={t("bookingActions.goBack")}
        disabled={update.isPending}
        onPress={close}
      />
    </FormScreen>
  );
}

export function ScheduleDetailsScreen({ id }: { id: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const schedule = useSchedule(id);

  if (schedule.data) return <ScheduleDetailsForm schedule={schedule.data} />;
  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      {schedule.isPending ? (
        <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />
      ) : (
        <Text accessibilityRole="alert" style={[styles.hint, { color: colors.text }]}>
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
    gap: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
});
