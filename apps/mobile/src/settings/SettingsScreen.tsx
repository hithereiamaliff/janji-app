import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { timeZoneCity } from "@/bookings/format";
import { Button } from "@/components/Button";
import { LoadErrorState } from "@/components/LoadErrorState";
import { Section } from "@/components/Section";
import { weekdayName } from "@/lib/calendar-date";
import { clockExample } from "@/profile/profile-text";
import { useProfile } from "@/profile/useProfile";
import { useSession, useSignedInAccount } from "@/session/SessionProvider";
import { useTheme } from "@/theme/useTheme";

function Setting({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} style={styles.setting}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.body, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function ProfileSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const router = useRouter();
  const profile = useProfile();

  let content: ReactNode;
  if (profile.data) {
    const { timeZone, timeFormat, weekStart } = profile.data;
    content = (
      <>
        <Setting
          label={t("settings.profile.timeZone")}
          value={t("availability.timeZoneValue", { city: timeZoneCity(timeZone), zone: timeZone })}
        />
        <Setting
          label={t("settings.profile.clock")}
          value={t(timeFormat === 12 ? "settings.profile.clock12" : "settings.profile.clock24", {
            example: clockExample(timeFormat, locale),
          })}
        />
        <Setting label={t("settings.profile.weekStart")} value={weekdayName(weekStart, locale)} />
        <Button
          variant="secondary"
          label={t("settings.edit.action")}
          onPress={() => router.push("/profile")}
        />
      </>
    );
  } else if (profile.isPending) {
    content = <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />;
  } else {
    content = (
      <LoadErrorState
        error={profile.error}
        onRetry={() => void profile.refetch()}
        fallbackMessage={t("settings.profile.loadFailed")}
      />
    );
  }

  return (
    <Section title={t("settings.profile.title")}>
      <View style={styles.group}>{content}</View>
    </Section>
  );
}

export function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { signOut } = useSession();
  const { user, serverOrigin } = useSignedInAccount();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await signOut();
    } catch {
      setSigningOut(false);
      setSignOutFailed(true);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Section title={t("settings.accountHeading")}>
        <Text style={[styles.name, { color: colors.text }]}>{user.name ?? user.username}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{user.email}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          {t("settings.server", { server: serverOrigin.replace(/^https?:\/\//, "") })}
        </Text>
      </Section>
      <ProfileSection />
      <Button
        variant="destructive"
        label={t("settings.signOut")}
        accessibilityHint={t("settings.signOutHint")}
        loading={signingOut}
        onPress={handleSignOut}
      />
      {signOutFailed ? (
        <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>
          {t("settings.signOutFailed")}
        </Text>
      ) : null}
      <Text style={[styles.body, { color: colors.textMuted }]}>{t("settings.comingSoon")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  group: {
    gap: 12,
  },
  setting: {
    gap: 2,
  },
  name: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
});
