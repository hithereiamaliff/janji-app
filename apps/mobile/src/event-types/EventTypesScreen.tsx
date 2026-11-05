import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { LoadErrorState } from "@/components/LoadErrorState";
import { useSignedInAccount } from "@/session/SessionProvider";
import { useTheme } from "@/theme/useTheme";
import { EventTypeRow } from "./EventTypeRow";
import { bookingLink } from "./event-type";
import { useEventTypes } from "./useEventTypes";

function RowGap() {
  return <View style={styles.rowGap} />;
}

export function EventTypesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const account = useSignedInAccount();
  const eventTypes = useEventTypes();
  // Tracked separately from isRefetching so background refreshes don't show the pull-to-refresh spinner.
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await eventTypes.refetch();
    setRefreshing(false);
  }

  if (eventTypes.isPending) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />
      </View>
    );
  }

  // isError would also cover a failed refresh, which keeps the list on screen with a notice instead.
  if (eventTypes.isLoadingError) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <LoadErrorState
          error={eventTypes.error}
          onRetry={() => void eventTypes.refetch()}
          fallbackMessage={t("eventTypes.loadFailed")}
        />
      </View>
    );
  }

  return (
    <FlatList
      testID="event-types-list"
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      data={eventTypes.data}
      keyExtractor={(eventType) => String(eventType.id)}
      renderItem={({ item }) => (
        <EventTypeRow
          eventType={item}
          link={bookingLink(account.serverOrigin, account.user.username, item.slug).replace(
            /^https?:\/\//,
            ""
          )}
          onPress={() => router.push({ pathname: "/event-type/[id]", params: { id: String(item.id) } })}
        />
      )}
      ItemSeparatorComponent={RowGap}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      ListHeaderComponent={
        eventTypes.isRefetchError ? (
          <Text accessibilityRole="alert" style={[styles.notice, { color: colors.danger }]}>
            {t("eventTypes.refreshFailed")}
          </Text>
        ) : undefined
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.textMuted }]}>{t("eventTypes.empty")}</Text>
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
  empty: {
    marginTop: 48,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
});
