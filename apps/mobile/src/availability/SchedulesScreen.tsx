import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { LoadErrorState } from "@/components/LoadErrorState";
import { useTheme } from "@/theme/useTheme";

import { ScheduleRow } from "./ScheduleRow";
import { useSchedules } from "./useSchedules";

function RowGap() {
  return <View style={styles.rowGap} />;
}

/** The Availability tab: the person's schedules, the default first. */
export function SchedulesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const schedules = useSchedules();
  // Tracked separately from isRefetching so background refreshes don't show the pull-to-refresh spinner.
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await schedules.refetch();
    setRefreshing(false);
  }

  if (schedules.isPending) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />
      </View>
    );
  }

  if (schedules.isLoadingError) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <LoadErrorState
          error={schedules.error}
          onRetry={() => void schedules.refetch()}
          fallbackMessage={t("availability.loadFailed")}
        />
      </View>
    );
  }

  return (
    <FlatList
      testID="schedules-list"
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      data={schedules.data}
      keyExtractor={(schedule) => String(schedule.id)}
      renderItem={({ item }) => (
        <ScheduleRow
          schedule={item}
          onPress={() => router.push({ pathname: "/schedule/[id]", params: { id: String(item.id) } })}
        />
      )}
      ItemSeparatorComponent={RowGap}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      ListHeaderComponent={
        schedules.isRefetchError ? (
          <Text accessibilityRole="alert" style={[styles.notice, { color: colors.danger }]}>
            {t("availability.refreshFailed")}
          </Text>
        ) : undefined
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.textMuted }]}>{t("availability.empty")}</Text>
      }
      ListFooterComponent={
        <View style={styles.footer}>
          <Button
            variant="secondary"
            label={t("availability.new.action")}
            onPress={() => router.push("/schedule/new")}
          />
        </View>
      }
    />
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
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  rowGap: {
    height: 8,
  },
  notice: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  footer: {
    marginTop: 16,
  },
  empty: {
    marginTop: 48,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
});
