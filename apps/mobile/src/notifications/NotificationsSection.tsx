import type { TFunction } from "i18next";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { LoadErrorState } from "@/components/LoadErrorState";
import { Section } from "@/components/Section";
import { ThemedSwitch } from "@/components/ThemedSwitch";
import { actionErrorMessage } from "@/lib/action-error";
import { useTheme } from "@/theme/useTheme";

import type { TurnOnResult } from "./notifications";
import type { PushRegistration } from "./registration-storage";
import { RelayRequestError } from "./relay-client";
import { useNotifications, useTurnOffNotifications, useTurnOnNotifications } from "./useNotifications";

type Refusal = Extract<TurnOnResult, { status: "notAllowed" }>["permission"];

function failureMessage(t: TFunction, error: unknown, fallback: string): string {
  if (error instanceof RelayRequestError) {
    if (error.status === null) return t("notifications.relayUnreachable");
    return error.status === 429 ? t("notifications.relayBusy") : fallback;
  }
  return actionErrorMessage(t, error, { fallback, notFound: fallback });
}

function openPhoneSettings() {
  // Without a settings app to open there's nothing more to do; the button stays for another try.
  Linking.openSettings().catch(() => undefined);
}

/** The switch for this phone's booking notifications, with what stops them when they can't work. */
export function NotificationsSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const notifications = useNotifications();
  const turnOn = useTurnOnNotifications();
  const turnOff = useTurnOffNotifications();
  // The phone's answer the last time notifications were turned on, if it didn't allow them.
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  function handleTurnOn() {
    setRefusal(null);
    turnOff.reset();
    turnOn.mutate(undefined, {
      onSuccess: (result) => {
        if (result.status === "notAllowed") setRefusal(result.permission);
      },
    });
  }

  function handleTurnOff(registration: PushRegistration) {
    setRefusal(null);
    turnOn.reset();
    turnOff.mutate(registration);
  }

  const state = notifications.data;
  const alertStyle = [styles.body, { color: colors.danger }];
  let content: ReactNode;
  if (!state) {
    content = notifications.isError ? (
      <LoadErrorState
        error={notifications.error}
        onRetry={() => void notifications.refetch()}
        fallbackMessage={t("notifications.loadFailed")}
      />
    ) : (
      <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />
    );
  } else if (state.status === "unavailable") {
    content = (
      <Text style={[styles.body, { color: colors.textMuted }]}>{t("notifications.unavailable")}</Text>
    );
  } else {
    const registration = state.status === "on" ? state.registration : null;
    const busy = turnOn.isPending || turnOff.isPending;
    // Notifications that are on can still be stopped by the phone, as after they were turned off in its
    // settings, or after a reinstall the saved registration outlived.
    const blocked = refusal === "blocked" || (registration !== null && state.permission === "blocked");
    const askAgain = registration !== null && state.permission === "canAsk";
    content = (
      <>
        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: colors.text }]}>{t("notifications.label")}</Text>
          <ThemedSwitch
            accessibilityLabel={t("notifications.label")}
            value={registration !== null}
            disabled={busy}
            onValueChange={(on) => {
              if (on) handleTurnOn();
              else if (registration) handleTurnOff(registration);
            }}
          />
        </View>
        <Text style={[styles.body, { color: colors.textMuted }]}>{t("notifications.description")}</Text>
        {busy ? (
          <ActivityIndicator
            accessibilityLabel={t(turnOn.isPending ? "notifications.turningOn" : "notifications.turningOff")}
            color={colors.accent}
          />
        ) : null}
        {blocked ? (
          <>
            <Text accessibilityRole="alert" style={alertStyle}>
              {t(registration ? "notifications.blockedWhileOn" : "notifications.blocked")}
            </Text>
            <Button variant="secondary" label={t("notifications.openSettings")} onPress={openPhoneSettings} />
          </>
        ) : null}
        {refusal === "canAsk" ? (
          <Text accessibilityRole="alert" style={alertStyle}>
            {t("notifications.notAllowed")}
          </Text>
        ) : null}
        {askAgain ? (
          <>
            <Text accessibilityRole="alert" style={alertStyle}>
              {t("notifications.notAllowedWhileOn")}
            </Text>
            <Button
              variant="secondary"
              label={t("notifications.allow")}
              disabled={busy}
              onPress={handleTurnOn}
            />
          </>
        ) : null}
        {turnOn.isError ? (
          <Text accessibilityRole="alert" style={alertStyle}>
            {failureMessage(t, turnOn.error, t("notifications.turnOnFailed"))}
          </Text>
        ) : null}
        {turnOff.isError ? (
          <Text accessibilityRole="alert" style={alertStyle}>
            {failureMessage(t, turnOff.error, t("notifications.turnOffFailed"))}
          </Text>
        ) : null}
      </>
    );
  }

  return (
    <Section title={t("notifications.title")}>
      <View style={styles.group}>{content}</View>
    </Section>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 12,
  },
  // 48 pt keeps the switch's row an easy touch target.
  switchRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
});
