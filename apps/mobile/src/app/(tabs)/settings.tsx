import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { useSession } from "@/session/SessionProvider";
import { useTheme } from "@/theme/useTheme";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { session, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  // The sign-in guard only shows the tabs while signed in.
  if (session.status !== "signedIn") return null;
  const { user, serverOrigin } = session.account;

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
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.textMuted }]}>
          {t("settings.accountHeading")}
        </Text>
        <Text style={[styles.name, { color: colors.text }]}>{user.name ?? user.username}</Text>
        <Text style={[styles.detail, { color: colors.textMuted }]}>{user.email}</Text>
        <Text style={[styles.detail, { color: colors.textMuted }]}>
          {t("settings.server", { server: serverOrigin.replace(/^https?:\/\//, "") })}
        </Text>
      </View>

      <Button
        variant="destructive"
        label={t("settings.signOut")}
        accessibilityHint={t("settings.signOutHint")}
        loading={signingOut}
        onPress={handleSignOut}
      />
      {signOutFailed ? (
        <Text accessibilityRole="alert" style={[styles.detail, { color: colors.danger }]}>
          {t("settings.signOutFailed")}
        </Text>
      ) : null}

      <Text style={[styles.detail, { color: colors.textMuted }]}>{t("settings.comingSoon")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  heading: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
  },
  detail: {
    fontSize: 15,
    lineHeight: 21,
  },
});
