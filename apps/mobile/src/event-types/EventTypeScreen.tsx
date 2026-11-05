import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { LoadErrorState } from "@/components/LoadErrorState";
import { Section } from "@/components/Section";
import { ThemedSwitch } from "@/components/ThemedSwitch";
import { actionErrorMessage } from "@/lib/action-error";
import { useSignedInAccount } from "@/session/SessionProvider";
import { useTheme } from "@/theme/useTheme";

import { bookingLink, type EventTypeSummary } from "./event-type";
import { lengthDetails } from "./lengths";
import { PrivateLinksSection } from "./PrivateLinksSection";
import { useEventType, useSetEventTypeHidden } from "./useEventTypes";

function LinkSection({ link }: { link: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    AccessibilityInfo.announceForAccessibility(t("eventTypes.linkCopied"));
  }

  function handleShare() {
    // iOS shares a url as a link, with a preview; Android only takes a message. Closing the share sheet, or
    // a browser without sharing, isn't an error worth showing.
    Share.share(Platform.OS === "ios" ? { url: link } : { message: link }).catch(() => undefined);
  }

  return (
    <Section title={t("eventTypes.link")}>
      <Text selectable style={[styles.body, { color: colors.text }]}>
        {link}
      </Text>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button variant="secondary" label={t("eventTypes.copyLink")} onPress={() => void handleCopy()} />
        </View>
        <View style={styles.action}>
          <Button variant="secondary" label={t("eventTypes.share")} onPress={handleShare} />
        </View>
      </View>
      {copied ? (
        <View style={styles.notice}>
          <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
          <Text style={[styles.body, { color: colors.text }]}>{t("eventTypes.linkCopied")}</Text>
        </View>
      ) : null}
    </Section>
  );
}

function VisibilitySection({ eventType, page }: { eventType: EventTypeSummary; page: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const setHidden = useSetEventTypeHidden();

  return (
    <Section title={t("eventTypes.visibility")}>
      <View style={styles.switchRow}>
        <Text style={[styles.body, styles.switchLabel, { color: colors.text }]}>
          {t("eventTypes.showOnPage")}
        </Text>
        <ThemedSwitch
          accessibilityLabel={t("eventTypes.showOnPage")}
          value={!eventType.hidden}
          onValueChange={(shown) => setHidden.mutate({ id: eventType.id, hidden: !shown })}
        />
      </View>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        {t("eventTypes.visibilityHint", { page })}
      </Text>
      {setHidden.isError ? (
        <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>
          {actionErrorMessage(t, setHidden.error, {
            fallback: t("eventTypes.visibilityFailed"),
            notFound: t("eventTypes.notFound"),
          })}
        </Text>
      ) : null}
    </Section>
  );
}

export function EventTypeScreen({ id }: { id: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const account = useSignedInAccount();
  const router = useRouter();
  const eventType = useEventType(id);

  if (eventType.isPending) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />
      </View>
    );
  }

  if (eventType.isLoadingError) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <LoadErrorState
          error={eventType.error}
          onRetry={() => void eventType.refetch()}
          fallbackMessage={t("eventTypes.loadFailed")}
        />
      </View>
    );
  }

  const details = eventType.data;
  if (!details) {
    return (
      <View style={[styles.centered, styles.padded, { backgroundColor: colors.background }]}>
        <Text accessibilityRole="alert" style={[styles.message, { color: colors.text }]}>
          {t("eventTypes.notFound")}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.heading}>
        {details.hidden ? (
          <View style={styles.badgeLine}>
            <Badge label={t("eventTypes.hidden")} color={colors.textMuted} />
          </View>
        ) : null}
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {details.title}
        </Text>
      </View>
      <Button
        variant="secondary"
        label={t("eventTypes.edit.action")}
        onPress={() => router.push({ pathname: "/event-type/[id]/edit", params: { id: String(details.id) } })}
      />
      <Section title={t("eventTypes.length")}>
        <Text style={[styles.body, { color: colors.text }]}>{lengthDetails(t, details)}</Text>
      </Section>
      <LinkSection link={bookingLink(account.serverOrigin, account.user.username, details.slug)} />
      <VisibilitySection
        eventType={details}
        page={`${account.serverOrigin.replace(/^https?:\/\//, "")}/${account.user.username}`}
      />
      <PrivateLinksSection eventType={details} />
      {details.description ? (
        <Section title={t("eventTypes.description")}>
          <Text selectable style={[styles.body, { color: colors.text }]}>
            {details.description}
          </Text>
        </Section>
      ) : null}
    </ScrollView>
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
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  action: {
    flex: 1,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  // 48 pt keeps the switch's row an easy touch target.
  switchRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  switchLabel: {
    flexShrink: 1,
  },
});
