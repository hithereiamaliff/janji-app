import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import type { TFunction } from "i18next";
import { type ComponentProps, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { LoadErrorState } from "@/components/LoadErrorState";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Section } from "@/components/Section";
import { actionErrorMessage } from "@/lib/action-error";
import { shareLink } from "@/lib/share-link";
import { useSession, useSignedInAccount } from "@/session/SessionProvider";
import { useTheme } from "@/theme/useTheme";

import { confirmBooking, markNoShow } from "./booking-actions";
import { type BookingAnswer, type BookingDetail, type BookingPerson, fieldNameLabel } from "./booking-detail";
import type { CalendarLink } from "./bookings-api";
import { formatFullDate, formatTimeRange, timeRangeElsewhere, timeZoneCity } from "./format";
import { describeLocation, phoneUrl } from "./location";
import { StatusBadge } from "./StatusBadge";
import { useBooking, useCalendarLinks } from "./useBooking";
import { useBookingAction } from "./useBookingAction";

type IconName = ComponentProps<typeof Ionicons>["name"];

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

type NoShowToggle = {
  /** This attendee's change is being saved. */
  updating: boolean;
  /** Another change is being saved, and changes go one at a time. */
  disabled: boolean;
  onToggle: () => void;
};

type AttendeeProps = SectionProps & {
  person: BookingPerson;
  /** Draws a line above, separating this attendee from the one before. */
  divided: boolean;
  /** Given once the booking has started, when Cal.diy lets hosts mark no-shows. */
  noShow?: NoShowToggle;
};

function Attendee({ person, booking, locale, divided, noShow }: AttendeeProps) {
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
      {noShow ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            person.noShow
              ? t("bookingActions.undoNoShowLabel", { name: person.name })
              : t("bookingActions.markNoShowLabel", { name: person.name })
          }
          accessibilityState={{ disabled: noShow.disabled || noShow.updating, busy: noShow.updating }}
          disabled={noShow.disabled || noShow.updating}
          onPress={noShow.onToggle}
          style={({ pressed }) => [styles.linkRow, { opacity: noShow.disabled ? 0.6 : pressed ? 0.7 : 1 }]}
        >
          {noShow.updating ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Ionicons
              name={person.noShow ? "arrow-undo-outline" : "person-remove-outline"}
              size={20}
              color={colors.accent}
            />
          )}
          <Text style={[styles.linkText, { color: colors.accent }]}>
            {person.noShow ? t("bookingActions.undoNoShow") : t("bookingActions.markNoShow")}
          </Text>
        </Pressable>
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
          {actionErrorMessage(t, confirmError, {
            fallback: t("bookingActions.confirmFailed"),
            notFound: t("bookingDetail.notFound"),
          })}
        </Text>
      ) : null}
    </Section>
  );
}

/** What can still be done to a confirmed booking that hasn't ended. */
function ManageActions({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.manage}>
      <Button
        variant="secondary"
        label={t("reschedule.action")}
        onPress={() => router.push({ pathname: "/booking/[uid]/reschedule", params: { uid } })}
      />
      <Button
        variant="secondary"
        label={t("bookingActions.addGuests")}
        onPress={() => router.push({ pathname: "/booking/[uid]/guests", params: { uid } })}
      />
      <Button
        variant="destructive"
        label={t("bookingActions.cancel")}
        onPress={() => router.push({ pathname: "/booking/[uid]/cancel", params: { uid } })}
      />
    </View>
  );
}

function openInBrowser(url: string) {
  // Without a browser to open there's nothing more to do; the button stays for another try.
  WebBrowser.openBrowserAsync(url).catch(() => undefined);
}

/** Shares the booking's page on the server, and while it's still to come, adds it to a web calendar. */
function ShareActions({ uid, upcoming }: { uid: string; upcoming: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { serverOrigin } = useSignedInAccount();
  const [calendarsShown, setCalendarsShown] = useState(false);
  const links = useCalendarLinks(uid, upcoming && calendarsShown);
  const calendarName = (link: CalendarLink) =>
    link.calendar === "other" ? link.label : t(`bookingDetail.calendars.${link.calendar}`);

  let calendars: ReactNode = null;
  if (upcoming && calendarsShown) {
    if (links.data) {
      calendars = links.data.map((link) => (
        <Button
          key={link.url}
          variant="secondary"
          label={calendarName(link)}
          accessibilityHint={t("bookingDetail.calendarHint", { calendar: calendarName(link) })}
          onPress={() => openInBrowser(link.url)}
        />
      ));
    } else if (links.isError) {
      calendars = (
        <LoadErrorState
          error={links.error}
          onRetry={() => void links.refetch()}
          fallbackMessage={t("bookingDetail.calendarsFailed")}
          notFoundMessage={t("bookingDetail.notFound")}
        />
      );
    } else {
      calendars = <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />;
    }
  }

  return (
    <View style={styles.manage}>
      <Button
        variant="secondary"
        label={t("bookingDetail.share")}
        accessibilityHint={t("bookingDetail.shareHint")}
        onPress={() => shareLink(`${serverOrigin}/booking/${uid}`)}
      />
      {upcoming ? (
        <Button
          variant="secondary"
          label={t("bookingDetail.addToCalendar")}
          expanded={calendarsShown}
          onPress={() => setCalendarsShown((shown) => !shown)}
        />
      ) : null}
      {calendars}
    </View>
  );
}

/** Confirms that a change went through. */
function Notice({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.notice}>
      <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
      <Text style={[styles.body, styles.noticeText, { color: colors.text }]}>{message}</Text>
    </View>
  );
}

type BookingDetailScreenProps = {
  uid: string;
  /** A change made on another screen that led here, such as the reschedule that created this booking. */
  notice?: "rescheduled";
};

export function BookingDetailScreen({ uid, notice }: BookingDetailScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const bookingQuery = useBooking(uid);
  // Lives here rather than in PendingActions, which unmounts as soon as the booking is confirmed.
  const confirm = useBookingAction(uid, confirmBooking);
  const noShow = useBookingAction(uid, markNoShow);
  // Tracked separately from isRefetching so background refreshes don't show the pull-to-refresh spinner.
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await bookingQuery.refetch();
    setRefreshing(false);
  }

  function toggleNoShow(person: BookingPerson) {
    const marking = !person.noShow;
    noShow.mutate([{ email: person.email, noShow: marking }], {
      onSuccess: () =>
        AccessibilityInfo.announceForAccessibility(
          marking
            ? t("bookingActions.markedNoShow", { name: person.name })
            : t("bookingActions.unmarkedNoShow", { name: person.name })
        ),
    });
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
  // Cal.diy refuses to cancel a booking that has ended, and to mark no-shows before it starts.
  const manageable = booking.status === "accepted" && Date.parse(booking.end) > Date.now();
  const canMarkNoShow = booking.status === "accepted" && Date.parse(booking.start) <= Date.now();
  const updatingNoShowFor = noShow.isPending ? noShow.variables?.[0]?.email : undefined;

  return (
    <ScreenScrollView
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
      {notice === "rescheduled" ? <Notice message={t("reschedule.done")} /> : null}
      {confirm.isSuccess ? <Notice message={t("bookingActions.confirmed")} /> : null}

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
              noShow={
                canMarkNoShow
                  ? {
                      updating: updatingNoShowFor === person.email,
                      disabled: noShow.isPending,
                      onToggle: () => toggleNoShow(person),
                    }
                  : undefined
              }
            />
          ))}
          {noShow.isError ? (
            <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>
              {actionErrorMessage(t, noShow.error, {
                fallback: t("bookingActions.noShowFailed"),
                notFound: t("bookingDetail.notFound"),
              })}
            </Text>
          ) : null}
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
      {inactive ? null : <ShareActions uid={uid} upcoming={Date.parse(booking.end) > Date.now()} />}
      {manageable ? <ManageActions uid={uid} /> : null}
    </ScreenScrollView>
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
  manage: {
    marginTop: 8,
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
