import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, StyleSheet, Text } from "react-native";

import { timeZoneCity } from "@/bookings/format";
import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { TextField } from "@/components/TextField";
import { actionErrorMessage } from "@/lib/action-error";
import { useSignedInAccount } from "@/session/SessionProvider";
import { useTheme } from "@/theme/useTheme";

import { weeklyHoursText } from "./hours-text";
import type { WeeklyHours } from "./schedule";
import { useCreateSchedule, useSchedules } from "./useSchedules";

/** What Cal.diy gives a schedule made without hours. */
const STARTING_HOURS: WeeklyHours[] = [
  { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], startTime: "09:00", endTime: "17:00" },
];

export function NewScheduleScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const account = useSignedInAccount();
  const [{ languageTag: locale }] = useLocales();
  const schedules = useSchedules();
  const create = useCreateSchedule();
  const [name, setName] = useState("");
  const [nameMissing, setNameMissing] = useState(false);
  const { timeZone } = account.user;
  // Someone without any schedule can't be booked, so their first one has to be the default.
  const first = schedules.data?.length === 0;

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace("/availability");
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameMissing(true);
      return;
    }
    setNameMissing(false);
    create.mutate(
      { name: trimmed, timeZone, isDefault: first },
      {
        onSuccess: (created) => {
          AccessibilityInfo.announceForAccessibility(t("availability.new.created"));
          router.replace({ pathname: "/schedule/[id]", params: { id: String(created.id) } });
        },
      }
    );
  }

  return (
    <FormScreen
      title={t("availability.new.title")}
      description={t("availability.new.description", {
        hours: weeklyHoursText(t, STARTING_HOURS, locale).join("; "),
      })}
    >
      <TextField
        label={t("availability.new.nameLabel")}
        hint={t("availability.new.nameHint")}
        value={name}
        onChangeText={setName}
        error={nameMissing ? t("availability.new.nameMissing") : null}
        editable={!create.isPending}
      />
      <Text style={[styles.note, { color: colors.textMuted }]}>
        {t("availability.new.timeZoneNote", { city: timeZoneCity(timeZone), zone: timeZone })}
      </Text>
      {first ? (
        <Text style={[styles.note, { color: colors.textMuted }]}>{t("availability.new.firstIsDefault")}</Text>
      ) : null}
      {create.isError ? (
        <Text accessibilityRole="alert" style={[styles.note, { color: colors.danger }]}>
          {actionErrorMessage(t, create.error, {
            fallback: t("availability.new.failed"),
            notFound: t("availability.notFound"),
          })}
        </Text>
      ) : null}
      <Button label={t("availability.new.create")} loading={create.isPending} onPress={handleCreate} />
      <Button
        variant="secondary"
        label={t("bookingActions.goBack")}
        disabled={create.isPending}
        onPress={close}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 14,
    lineHeight: 20,
  },
});
