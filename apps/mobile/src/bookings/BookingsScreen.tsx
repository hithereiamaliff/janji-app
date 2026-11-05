import { useLocales } from "expo-localization";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, SectionList, StyleSheet, Text, TextInput, View } from "react-native";

import { FilterTabs } from "@/components/FilterTabs";
import { LoadErrorState } from "@/components/LoadErrorState";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTheme } from "@/theme/useTheme";

import { BookingRow } from "./BookingRow";
import { BOOKING_FILTERS, type BookingFilter } from "./bookings-api";
import { formatDayHeading } from "./format";
import { groupByDay } from "./group-by-day";
import { useBookings } from "./useBookings";

const SEARCH_DELAY_MS = 400;

function RowGap() {
  return <View style={styles.rowGap} />;
}

export function BookingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const [filter, setFilter] = useState<BookingFilter>("upcoming");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), SEARCH_DELAY_MS);
  // Tracked separately from TanStack's isRefetching so background refreshes (like returning to the app)
  // don't show the pull-to-refresh spinner.
  const [refreshing, setRefreshing] = useState(false);
  const bookingsQuery = useBookings(filter, search);
  const { bookings, dataUpdatedAt } = bookingsQuery;

  const filterOptions = useMemo(
    () => BOOKING_FILTERS.map((value) => ({ value, label: t(`bookings.filters.${value}`) })),
    [t]
  );

  const sections = useMemo(() => {
    const now = new Date(dataUpdatedAt || Date.now());
    const labels = {
      today: t("bookings.days.today"),
      tomorrow: t("bookings.days.tomorrow"),
      yesterday: t("bookings.days.yesterday"),
    };
    return groupByDay(bookings, (startIso) => formatDayHeading(startIso, { locale, now, labels }));
  }, [bookings, dataUpdatedAt, locale, t]);

  async function handleRefresh() {
    setRefreshing(true);
    await bookingsQuery.refetch();
    setRefreshing(false);
  }

  function handleEndReached() {
    if (bookingsQuery.hasNextPage && !bookingsQuery.isFetchingNextPage) void bookingsQuery.fetchNextPage();
  }

  let body: React.ReactNode;
  if (bookingsQuery.isPending) {
    body = (
      <View style={styles.centered}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />
      </View>
    );
  } else if (bookingsQuery.isLoadingError) {
    // isError would also cover a failed refresh, which keeps the bookings already shown (see ListHeaderComponent).
    body = (
      <LoadErrorState
        error={bookingsQuery.error}
        onRetry={() => void bookingsQuery.refetch()}
        fallbackMessage={t("bookings.loadFailed")}
      />
    );
  } else {
    body = (
      <SectionList
        testID="bookings-list"
        sections={sections}
        keyExtractor={(booking) => booking.uid}
        renderItem={({ item }) => <BookingRow booking={item} locale={locale} />}
        renderSectionHeader={({ section }) => (
          <Text
            accessibilityRole="header"
            style={[styles.sectionHeader, { color: colors.textMuted, backgroundColor: colors.background }]}
          >
            {section.title}
          </Text>
        )}
        ItemSeparatorComponent={RowGap}
        stickySectionHeadersEnabled
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          bookingsQuery.isRefetchError ? (
            <Text accessibilityRole="alert" style={[styles.notice, { color: colors.danger }]}>
              {t("bookings.refreshFailed")}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          <Text style={[styles.message, styles.empty, { color: colors.textMuted }]}>
            {search ? t("bookings.empty.search", { search }) : t(`bookings.empty.${filter}`)}
          </Text>
        }
        ListFooterComponent={
          bookingsQuery.isFetchingNextPage ? (
            <ActivityIndicator
              accessibilityLabel={t("common.loading")}
              color={colors.accent}
              style={styles.footer}
            />
          ) : undefined
        }
        contentContainerStyle={styles.listContent}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FilterTabs
        options={filterOptions}
        value={filter}
        onChange={setFilter}
        accessibilityLabel={t("bookings.filters.label")}
      />
      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel={t("bookings.searchLabel")}
          placeholder={t("bookings.searchPlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={searchInput}
          onChangeText={setSearchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={[
            styles.search,
            { color: colors.text, backgroundColor: colors.surface, borderColor: colors.inputBorder },
          ]}
        />
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  message: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
  empty: {
    marginTop: 48,
  },
  notice: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "600",
    paddingTop: 16,
    paddingBottom: 8,
  },
  rowGap: {
    height: 8,
  },
  footer: {
    marginTop: 16,
  },
});
