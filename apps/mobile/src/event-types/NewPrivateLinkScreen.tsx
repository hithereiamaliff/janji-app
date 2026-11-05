import { addDays, endOfDay } from "date-fns";
import * as Clipboard from "expo-clipboard";
import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { formatFullDate } from "@/bookings/format";
import { Button } from "@/components/Button";
import { FilterTabs } from "@/components/FilterTabs";
import { FormScreen } from "@/components/FormScreen";
import { TextField } from "@/components/TextField";
import { actionErrorMessage } from "@/lib/action-error";
import { shareLink } from "@/lib/share-link";
import { wholeNumber } from "@/lib/whole-number";
import { useSignedInAccount } from "@/session/SessionProvider";
import { useTheme } from "@/theme/useTheme";

import { type EventTypeSummary, readableLink } from "./event-type";
import { linkStatus } from "./private-link-status";
import { type PrivateLink, privateLinkUrl } from "./private-links";
import type { NewPrivateLinkLimit } from "./private-links-api";
import { useEventType } from "./useEventTypes";
import { useCreatePrivateLink } from "./usePrivateLinks";

/** FormScreen's side padding, which the tabs reach past to scroll edge to edge. */
const FORM_PADDING = 24;

type LimitKind = NewPrivateLinkLimit["kind"];

/** How many days after today the link's last day is. */
const LAST_DAYS = [
  { days: 0, label: "privateLinks.new.today" },
  { days: 1, label: "privateLinks.new.untilTomorrow" },
  { days: 7, label: "privateLinks.new.oneWeek" },
  { days: 14, label: "privateLinks.new.twoWeeks" },
  { days: 30, label: "privateLinks.new.thirtyDays" },
] as const;

function CreatedLink({ link, url, onDone }: { link: PrivateLink; url: string; onDone: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    AccessibilityInfo.announceForAccessibility(t("eventTypes.linkCopied"));
  }

  return (
    <FormScreen title={t("privateLinks.new.readyTitle")} description={t("privateLinks.new.readyDescription")}>
      <View style={styles.group}>
        <Text selectable style={[styles.link, { color: colors.text }]}>
          {readableLink(url)}
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{linkStatus(t, link, locale)}</Text>
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button variant="secondary" label={t("eventTypes.copyLink")} onPress={() => void handleCopy()} />
        </View>
        <View style={styles.action}>
          <Button variant="secondary" label={t("eventTypes.share")} onPress={() => shareLink(url)} />
        </View>
      </View>
      {copied ? (
        <Text style={[styles.hint, { color: colors.text }]}>{t("eventTypes.linkCopied")}</Text>
      ) : null}
      <Button label={t("privateLinks.new.done")} onPress={onDone} />
    </FormScreen>
  );
}

function NewPrivateLinkForm({ eventType }: { eventType: EventTypeSummary }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const account = useSignedInAccount();
  const [{ languageTag: locale }] = useLocales();
  const create = useCreatePrivateLink(eventType.id);
  // Fixed when the form opens, so the last day shown doesn't move while someone looks at it.
  const [openedAt] = useState(() => new Date());
  const [kind, setKind] = useState<LimitKind>("bookings");
  const [bookings, setBookings] = useState("1");
  const [lastDay, setLastDay] = useState(7);
  const [bookingsInvalid, setBookingsInvalid] = useState(false);
  const expiresAt = endOfDay(addDays(openedAt, lastDay));

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/event-type/[id]", params: { id: String(eventType.id) } });
  }

  function handleCreate() {
    let limit: NewPrivateLinkLimit = { kind: "date", expiresAt };
    if (kind === "bookings") {
      const max = wholeNumber(bookings);
      if (max === null || max < 1) {
        setBookingsInvalid(true);
        return;
      }
      limit = { kind: "bookings", max };
    }
    setBookingsInvalid(false);
    create.mutate(limit, {
      onSuccess: () => AccessibilityInfo.announceForAccessibility(t("privateLinks.new.created")),
    });
  }

  if (create.data) {
    return (
      <CreatedLink
        link={create.data}
        url={privateLinkUrl(account.serverOrigin, create.data.id, eventType.slug)}
        onDone={close}
      />
    );
  }

  return (
    <FormScreen
      title={t("privateLinks.new.title")}
      description={t("privateLinks.new.description", { title: eventType.title })}
    >
      <View style={styles.group}>
        <Text style={[styles.label, { color: colors.text }]}>{t("privateLinks.new.limitLabel")}</Text>
        <FilterTabs
          options={[
            { value: "bookings", label: t("privateLinks.new.afterBookings") },
            { value: "date", label: t("privateLinks.new.afterADate") },
          ]}
          value={kind}
          onChange={setKind}
          accessibilityLabel={t("privateLinks.new.limitLabel")}
          containerPadding={FORM_PADDING}
        />
      </View>
      {kind === "bookings" ? (
        <TextField
          label={t("privateLinks.new.bookingsLabel")}
          hint={t("privateLinks.new.bookingsHint")}
          value={bookings}
          onChangeText={setBookings}
          error={bookingsInvalid ? t("privateLinks.new.bookingsInvalid") : null}
          keyboardType="number-pad"
          editable={!create.isPending}
        />
      ) : (
        <View style={styles.group}>
          <Text style={[styles.label, { color: colors.text }]}>{t("privateLinks.new.lastDayLabel")}</Text>
          <FilterTabs
            options={LAST_DAYS.map((choice) => ({ value: String(choice.days), label: t(choice.label) }))}
            value={String(lastDay)}
            onChange={(days) => setLastDay(Number(days))}
            accessibilityLabel={t("privateLinks.new.lastDayLabel")}
            containerPadding={FORM_PADDING}
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t("privateLinks.new.endsAt", { date: formatFullDate(expiresAt.toISOString(), locale) })}
          </Text>
        </View>
      )}
      {create.isError ? (
        <Text accessibilityRole="alert" style={[styles.hint, { color: colors.danger }]}>
          {actionErrorMessage(t, create.error, {
            fallback: t("privateLinks.new.failed"),
            notFound: t("eventTypes.notFound"),
          })}
        </Text>
      ) : null}
      <Button label={t("privateLinks.new.create")} loading={create.isPending} onPress={handleCreate} />
      <Button
        variant="secondary"
        label={t("bookingActions.goBack")}
        disabled={create.isPending}
        onPress={close}
      />
    </FormScreen>
  );
}

export function NewPrivateLinkScreen({ id }: { id: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const eventType = useEventType(id);

  if (eventType.data) return <NewPrivateLinkForm eventType={eventType.data} />;
  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      {eventType.isPending ? (
        <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />
      ) : (
        <Text accessibilityRole="alert" style={[styles.hint, { color: colors.text }]}>
          {eventType.isError ? t("eventTypes.loadFailed") : t("eventTypes.notFound")}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  group: {
    gap: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
  link: {
    fontSize: 16,
    lineHeight: 23,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  action: {
    flex: 1,
  },
});
