import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { TimeZonePicker } from "@/availability/TimeZonePicker";
import { Button } from "@/components/Button";
import { FilterTabs } from "@/components/FilterTabs";
import { FormScreen } from "@/components/FormScreen";
import { LoadErrorState } from "@/components/LoadErrorState";
import { TextField } from "@/components/TextField";
import { actionErrorMessage } from "@/lib/action-error";
import { weekdayName } from "@/lib/calendar-date";
import type { Profile } from "@/profile/profile";
import type { ProfileChanges } from "@/profile/profile-api";
import { clockExample } from "@/profile/profile-text";
import { useProfile, useUpdateProfile } from "@/profile/useProfile";
import { useTheme } from "@/theme/useTheme";

// The web's profile form allows names up to this long.
const NAME_LIMIT = 50;
// FormScreen's side padding, which the choices reach past to scroll edge to edge.
const FORM_PADDING = 24;

function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const router = useRouter();
  const update = useUpdateProfile();
  // As the form found it, so a refresh while it's open doesn't change what counts as edited.
  const [original] = useState(profile);
  const [name, setName] = useState(original.name ?? "");
  const [timeZone, setTimeZone] = useState(original.timeZone);
  const [timeFormat, setTimeFormat] = useState(original.timeFormat);
  const [weekStart, setWeekStart] = useState(original.weekStart);
  const [nameMissing, setNameMissing] = useState(false);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace("/settings");
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameMissing(true);
      return;
    }
    setNameMissing(false);
    const changes: ProfileChanges = {};
    if (trimmed !== (original.name ?? "")) changes.name = trimmed;
    if (timeZone !== original.timeZone) changes.timeZone = timeZone;
    if (timeFormat !== original.timeFormat) changes.timeFormat = timeFormat;
    if (weekStart !== original.weekStart) changes.weekStart = weekStart;
    if (Object.keys(changes).length === 0) {
      close();
      return;
    }
    update.mutate(changes, {
      onSuccess: () => {
        AccessibilityInfo.announceForAccessibility(t("settings.edit.saved"));
        close();
      },
    });
  }

  return (
    <FormScreen title={t("settings.edit.title")}>
      <TextField
        label={t("settings.edit.nameLabel")}
        value={name}
        onChangeText={setName}
        error={nameMissing ? t("settings.edit.nameMissing") : null}
        editable={!update.isPending}
        maxLength={NAME_LIMIT}
        autoComplete="name"
      />
      <View style={styles.group}>
        <Text style={[styles.label, { color: colors.text }]}>{t("settings.profile.timeZone")}</Text>
        <TimeZonePicker value={timeZone} onChange={setTimeZone} disabled={update.isPending} />
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t("settings.edit.timeZoneHint")}</Text>
      </View>
      <View style={styles.group}>
        <Text style={[styles.label, { color: colors.text }]}>{t("settings.profile.clock")}</Text>
        <FilterTabs
          kind="choices"
          accessibilityLabel={t("settings.profile.clock")}
          options={[
            { value: "12", label: t("settings.edit.clock12", { example: clockExample(12, locale) }) },
            { value: "24", label: t("settings.edit.clock24", { example: clockExample(24, locale) }) },
          ]}
          value={String(timeFormat)}
          onChange={(value) => setTimeFormat(value === "24" ? 24 : 12)}
          containerPadding={FORM_PADDING}
          disabled={update.isPending}
        />
      </View>
      <View style={styles.group}>
        <Text style={[styles.label, { color: colors.text }]}>{t("settings.profile.weekStart")}</Text>
        <FilterTabs
          kind="choices"
          accessibilityLabel={t("settings.profile.weekStart")}
          options={Array.from({ length: 7 }, (_, day) => ({
            value: String(day),
            label: weekdayName(day, locale),
          }))}
          value={String(weekStart)}
          onChange={(value) => setWeekStart(Number(value))}
          containerPadding={FORM_PADDING}
          disabled={update.isPending}
        />
      </View>
      {update.isError ? (
        <Text accessibilityRole="alert" style={[styles.hint, { color: colors.danger }]}>
          {actionErrorMessage(t, update.error, {
            fallback: t("settings.edit.failed"),
            notFound: t("settings.edit.failed"),
          })}
        </Text>
      ) : null}
      <Button label={t("settings.edit.save")} loading={update.isPending} onPress={handleSave} />
      <Button
        variant="secondary"
        label={t("bookingActions.goBack")}
        disabled={update.isPending}
        onPress={close}
      />
    </FormScreen>
  );
}

/** Changes the profile settings the app shows: the name, time zone, clock and first day of the week. */
export function ProfileFormScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const profile = useProfile();

  if (profile.data) return <ProfileForm profile={profile.data} />;
  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      {profile.isPending ? (
        <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />
      ) : (
        <LoadErrorState
          error={profile.error}
          onRetry={() => void profile.refetch()}
          fallbackMessage={t("settings.profile.loadFailed")}
        />
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
