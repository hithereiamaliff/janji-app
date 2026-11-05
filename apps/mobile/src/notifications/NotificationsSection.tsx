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
import { chosenTriggers, type PushRegistration } from "./registration-storage";
import { RelayRequestError } from "./relay-client";
import {
  useChooseNotificationEvents,
  useNotifications,
  useTurnOffNotifications,
  useTurnOnNotifications,
} from "./useNotifications";
import { HOOK_TRIGGERS, type HookTrigger } from "./webhooks-api";

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

/** Which booking events notify this phone. One always stays on: to get none, notifications go off. */
function EventChoices({ registration, disabled }: { registration: PushRegistration; disabled: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const choose = useChooseNotificationEvents();
  // The choice being saved shows at once, so a switch doesn't flick back while the saved one loads.
  const shown = choose.isPending && choose.variables ? choose.variables : chosenTriggers(registration);

  function toggle(trigger: HookTrigger, on: boolean) {
    choose.mutate(HOOK_TRIGGERS.filter((each) => (each === trigger ? on : shown.includes(each))));
  }

  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={[styles.subheading, { color: colors.text }]}>
        {t("notifications.events.title")}
      </Text>
      {HOOK_TRIGGERS.map((trigger) => {
        const on = shown.includes(trigger);
        const label = t(`notifications.events.${trigger}`);
        return (
          <View key={trigger} style={styles.switchRow}>
            <Text style={[styles.body, styles.eventLabel, { color: colors.text }]}>{label}</Text>
            <ThemedSwitch
              accessibilityLabel={label}
              value={on}
              disabled={disabled || choose.isPending || (on && shown.length === 1)}
              onValueChange={(next) => toggle(trigger, next)}
            />
          </View>
        );
      })}
      {shown.length === 1 ? (
        <Text style={[styles.body, { color: colors.textMuted }]}>{t("notifications.events.lastOne")}</Text>
      ) : null}
      {choose.isError ? (
        <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>
          {failureMessage(t, choose.error, t("notifications.events.failed"))}
        </Text>
      ) : null}
    </View>
  );
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

  function handleTurnOff() {
    setRefusal(null);
    turnOn.reset();
    turnOff.mutate();
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
  } else if (state.status === "unavailable" || state.relay.origin === null) {
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
              else handleTurnOff();
            }}
          />
        </View>
        <Text style={[styles.body, { color: colors.textMuted }]}>{t("notifications.description")}</Text>
        {registration ? <EventChoices registration={registration} disabled={busy} /> : null}
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
  subheading: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
  },
  eventLabel: {
    flex: 1,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
});
