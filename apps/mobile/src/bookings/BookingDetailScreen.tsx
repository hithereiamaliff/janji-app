import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { type ComponentProps, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { LoadErrorState } from "@/components/LoadErrorState";
import { useSession } from "@/session/SessionProvider";
import { useTheme } from "@/theme/useTheme";

import { actionErrorMessage } from "./action-error";
import { confirmBooking } from "./booking-actions";
import { type BookingAnswer, type BookingDetail, type BookingPerson, fieldNameLabel } from "./booking-detail";
import { formatFullDate, formatTimeRange, timeRangeElsewhere, timeZoneCity } from "./format";
import { describeLocation, phoneUrl } from "./location";
import { StatusBadge } from "./StatusBadge";
import { useBooking } from "./useBooking";
import { useBookingAction } from "./useBookingAction";

type IconName = ComponentProps<typeof Ionicons>["name"];

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

type LinkRowProps = {
  icon: IconName;
  label: string;
  url: string;
  /** Says what the link does when the visible label is only an address or number. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

function LinkRow({ icon, label, url, accessibilityLabel, accessibilityHint }: LinkRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      // With no app to handle the link there's nothing more to do; the address stays on screen.
      onPress={() => Linking.openURL(url).catch(() => undefined)}
      style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text style={[styles.linkText, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

type SectionProps = {
  booking: BookingDetail;
  locale: string;
};

function WhenSection({ booking, locale }: SectionProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { session } = useSession();
  // Confirmation emails and the web app show times in the profile's time zone, so when the device is
  // elsewhere, the profile's time helps match them up.
  const profileTimeZone = session.status === "signedIn" ? session.account.user.timeZone : null;
  const profileTime = profileTimeZone
    ? timeRangeElsewhere(booking.start, booking.end, locale, profileTimeZone)
    : null;

  return (
    <Section title={t("bookingDetail.when")}>
      <Text style={[styles.strong, { color: colors.text }]}>{formatFullDate(booking.start, locale)}</Text>
      <Text style={[styles.body, { color: colors.text }]}>
        {formatTimeRange(booking.start, booking.end, locale)}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        {t("bookingDetail.duration", { count: booking.durationMinutes })}
      </Text>
      {profileTime && profileTimeZone ? (
        <Text style={[styles.body, { color: colors.textMuted }]}>
          {t("bookingDetail.inProfileTimeZone", { time: profileTime, zone: timeZoneCity(profileTimeZone) })}
        </Text>
      ) : null}
      {booking.isRecurring ? (
        <Text style={[styles.body, { color: colors.textMuted }]}>{t("bookingDetail.recurring")}</Text>
      ) : null}
      {booking.reschedulingReason ? (
        <Text selectable style={[styles.body, { color: colors.textMuted }]}>
          {t("bookingDetail.reschedulingReason", { reason: booking.reschedulingReason })}
        </Text>
      ) : null}
    </Section>
  );
}

function WhereSection({ location }: { location: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const place = describeLocation(location);

  let content: ReactNode;
  switch (place.kind) {
    case "link":
      content = (
        <LinkRow
          icon="videocam-outline"
          label={t("bookingDetail.joinMeeting")}
          accessibilityHint={t("bookingDetail.joinMeetingHint", { host: place.host })}
          url={place.url}
        />
      );
      break;
    case "phone":
      content = (
        <LinkRow
          icon="call-outline"
          label={place.number}
          accessibilityLabel={t("bookingDetail.call", { number: place.number })}
          url={phoneUrl(place.number)}
        />
      );
      break;
    case "app":
      content = <Text style={[styles.body, { color: colors.text }]}>{t("bookingDetail.onlineMeeting")}</Text>;
      break;
    case "text":
      content = (
        <Text selectable style={[styles.body, { color: colors.text }]}>
          {place.text}
        </Text>
      );
      break;
  }

  return (
    <Section title={t("bookingDetail.where")}>
      {content}
      {place.kind === "link" ? (
        <Text style={[styles.body, { color: colors.textMuted }]}>{place.host}</Text>
      ) : null}
    </Section>
  );
}

type AttendeeProps = SectionProps & {
  person: BookingPerson;
  /** Draws a line above, separating this attendee from the one before. */
  divided: boolean;
};

function Attendee({ person, booking, locale, divided }: AttendeeProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const theirTime = person.timeZone
    ? timeRangeElsewhere(booking.start, booking.end, locale, person.timeZone)
    : null;

  return (
    <View style={[styles.person, divided ? [styles.divided, { borderTopColor: colors.border }] : null]}>
      <View style={styles.nameLine}>
        <Text style={[styles.strong, styles.name, { color: colors.text }]}>{person.name}</Text>
        {person.noShow ? <Badge label={t("bookingDetail.noShow")} color={colors.danger} /> : null}
      </View>
      <LinkRow
        icon="mail-outline"
        label={person.displayEmail}
        accessibilityLabel={t("bookingDetail.email", { email: person.displayEmail })}
        url={`mailto:${person.displayEmail}`}
      />
      {person.phoneNumber ? (
        <LinkRow
          icon="call-outline"
          label={person.phoneNumber}
          accessibilityLabel={t("bookingDetail.call", { number: person.phoneNumber })}
          url={phoneUrl(person.phoneNumber)}
        />
      ) : null}
      {theirTime && person.timeZone ? (
        <Text style={[styles.body, { color: colors.textMuted }]}>
          {t("bookingDetail.theirTime", { time: theirTime, zone: timeZoneCity(person.timeZone) })}
        </Text>
      ) : null}
    </View>
  );
}

function answerText(t: TFunction, value: BookingAnswer["value"]): string {
  if (typeof value === "boolean") return value ? t("bookingDetail.yes") : t("bookingDetail.no");
  return value;
}

function AnswersSection({ answers }: { answers: BookingAnswer[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Section title={t("bookingDetail.answers")}>
      {answers.map((answer) => (
        <View key={answer.field} style={styles.answer}>
          <Text style={[styles.answerLabel, { color: colors.textMuted }]}>
            {fieldNameLabel(answer.field)}
          </Text>
          <Text selectable style={[styles.body, { color: colors.text }]}>
            {answerText(t, answer.value)}
          </Text>
        </View>
      ))}
    </Section>
  );
}

type PendingActionsProps = {
  uid: string;
  confirming: boolean;
  confirmError: Error | null;
  onConfirm: () => void;
};

function PendingActions({ uid, confirming, confirmError, onConfirm }: PendingActionsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Section title={t("bookingActions.pendingTitle")}>
      <Text style={[styles.body, { color: colors.text }]}>{t("bookingActions.pendingDescription")}</Text>
      <View style={styles.actions}>
        <Button label={t("bookingActions.confirm")} loading={confirming} onPress={onConfirm} />
        <Button
          variant="destructive"
          label={t("bookingActions.decline")}
          disabled={confirming}
          onPress={() => router.push({ pathname: "/booking/[uid]/decline", params: { uid } })}
        />
      </View>
      {confirmError ? (
        <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>
          {actionErrorMessage(t, confirmError, t("bookingActions.confirmFailed"))}
        </Text>
      ) : null}
    </Section>
  );
}

export function BookingDetailScreen({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const bookingQuery = useBooking(uid);
  // Lives here rather than in PendingActions, which unmounts as soon as the booking is confirmed.
  const confirm = useBookingAction(uid, confirmBooking);
  // Tracked separately from isRefetching so background refreshes don't show the pull-to-refresh spinner.
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await bookingQuery.refetch();
    setRefreshing(false);
  }

  function handleConfirm() {
    confirm.mutate(undefined, {
      onSuccess: () => AccessibilityInfo.announceForAccessibility(t("bookingActions.confirmed")),
    });
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
      {confirm.isSuccess ? (
        <View style={styles.notice}>
          <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
          <Text style={[styles.body, styles.noticeText, { color: colors.text }]}>
            {t("bookingActions.confirmed")}
          </Text>
        </View>
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
        {booking.cancellationReason ? (
          <Text selectable style={[styles.body, { color: colors.textMuted }]}>
            {t("bookingDetail.cancellationReason", { reason: booking.cancellationReason })}
          </Text>
        ) : null}
      </View>

      {booking.status === "pending" ? (
        <PendingActions
          uid={uid}
          confirming={confirm.isPending}
          confirmError={confirm.error}
          onConfirm={handleConfirm}
        />
      ) : null}
      <WhenSection booking={booking} locale={locale} />
      {booking.location ? <WhereSection location={booking.location} /> : null}
      {booking.attendees.length > 0 ? (
        <Section title={t("bookingDetail.attendees")}>
          {booking.attendees.map((person, index) => (
            <Attendee
              key={person.email}
              person={person}
              booking={booking}
              locale={locale}
              divided={index > 0}
            />
          ))}
        </Section>
      ) : null}
      {booking.description ? (
        <Section title={t("bookingDetail.notes")}>
          <Text selectable style={[styles.body, { color: colors.text }]}>
            {booking.description}
          </Text>
        </Section>
      ) : null}
      {booking.answers.length > 0 ? <AnswersSection answers={booking.answers} /> : null}
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
  actions: {
    marginTop: 12,
    gap: 12,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noticeText: {
    flexShrink: 1,
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
  // 44 pt keeps each link above the iOS minimum touch target.
  linkRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  linkText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  person: {
    paddingVertical: 4,
  },
  answer: {
    paddingVertical: 4,
  },
  answerLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 12,
  },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flexShrink: 1,
  },
});
