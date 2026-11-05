import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { Badge } from "@/components/Badge";
import { LoadErrorState } from "@/components/LoadErrorState";
import { useTheme } from "@/theme/useTheme";

import { lengthDetails } from "./lengths";
import { useEventType } from "./useEventTypes";

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function EventTypeScreen({ id }: { id: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
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
      <Section title={t("eventTypes.length")}>
        <Text style={[styles.body, { color: colors.text }]}>{lengthDetails(t, details)}</Text>
      </Section>
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
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
});
