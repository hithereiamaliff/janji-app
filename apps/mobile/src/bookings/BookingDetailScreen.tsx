import { useLocales } from "expo-localization";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { LoadErrorState } from "@/components/LoadErrorState";
import { useTheme } from "@/theme/useTheme";

import type { BookingDetail } from "./booking-detail";
import { formatFullDate, formatTimeRange } from "./format";
import { StatusBadge } from "./StatusBadge";
import { useBooking } from "./useBooking";

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

type SectionProps = {
  booking: BookingDetail;
  locale: string;
};

function WhenSection({ booking, locale }: SectionProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Section title={t("bookingDetail.when")}>
      <Text style={[styles.strong, { color: colors.text }]}>{formatFullDate(booking.start, locale)}</Text>
      <Text style={[styles.body, { color: colors.text }]}>
        {formatTimeRange(booking.start, booking.end, locale)}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        {t("bookingDetail.duration", { count: booking.durationMinutes })}
      </Text>
      {booking.isRecurring ? (
        <Text style={[styles.body, { color: colors.textMuted }]}>{t("bookingDetail.recurring")}</Text>
      ) : null}
    </Section>
  );
}

export function BookingDetailScreen({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const bookingQuery = useBooking(uid);
  // Tracked separately from isRefetching so background refreshes don't show the pull-to-refresh spinner.
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await bookingQuery.refetch();
    setRefreshing(false);
  }

  if (bookingQuery.isPending) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />
      </View>
    );
  }

  // isError would also cover a failed refresh, which keeps the booking on screen with a notice instead.
  if (bookingQuery.isLoadingError) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <LoadErrorState
          error={bookingQuery.error}
          onRetry={() => void bookingQuery.refetch()}
          fallbackMessage={t("bookingDetail.loadFailed")}
          notFoundMessage={t("bookingDetail.notFound")}
        />
      </View>
    );
  }

  const booking = bookingQuery.data;
  const inactive = booking.status === "cancelled" || booking.status === "rejected";

  return (
    <ScrollView
      testID="booking-detail"
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {bookingQuery.isRefetchError ? (
        <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>
          {t("bookingDetail.refreshFailed")}
        </Text>
      ) : null}

      <View style={styles.heading}>
        {booking.status === "accepted" ? null : (
          <View style={styles.badgeLine}>
            <StatusBadge status={booking.status} />
          </View>
        )}
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: inactive ? colors.textMuted : colors.text }]}
        >
          {booking.title}
        </Text>
      </View>

      <WhenSection booking={booking} locale={locale} />
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
  strong: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
});
