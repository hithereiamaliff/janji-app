import * as Clipboard from "expo-clipboard";
import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { LoadErrorState } from "@/components/LoadErrorState";
import { Section } from "@/components/Section";
import { actionErrorMessage } from "@/lib/action-error";
import { shareLink } from "@/lib/share-link";
import { useSignedInAccount } from "@/session/SessionProvider";
import { useTheme } from "@/theme/useTheme";

import { type EventTypeSummary, readableLink } from "./event-type";
import { linkStatus } from "./private-link-status";
import { type PrivateLink, privateLinkUrl } from "./private-links";
import { useDeletePrivateLink, usePrivateLinks } from "./usePrivateLinks";

function PrivateLinkRow({ link, url, eventTypeId }: { link: PrivateLink; url: string; eventTypeId: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [{ languageTag: locale }] = useLocales();
  const remove = useDeletePrivateLink(eventTypeId);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const status = linkStatus(t, link, locale);

  async function handleCopy() {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    AccessibilityInfo.announceForAccessibility(t("eventTypes.linkCopied"));
  }

  function handleDelete() {
    remove.mutate(link.id, {
      onSuccess: () => AccessibilityInfo.announceForAccessibility(t("privateLinks.deleted")),
    });
  }

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      {link.expired ? (
        <View style={styles.badgeLine}>
          <Badge label={t("privateLinks.expired")} color={colors.textMuted} />
        </View>
      ) : null}
      <Text selectable style={[styles.body, { color: link.expired ? colors.textMuted : colors.text }]}>
        {readableLink(url)}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{status}</Text>
      {confirming ? (
        <View style={styles.confirm}>
          <Text style={[styles.body, { color: colors.text }]}>{t("privateLinks.deleteQuestion")}</Text>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                variant="destructive"
                label={t("privateLinks.deleteConfirm")}
                loading={remove.isPending}
                onPress={handleDelete}
              />
            </View>
            <View style={styles.action}>
              <Button
                variant="secondary"
                label={t("privateLinks.keep")}
                disabled={remove.isPending}
                onPress={() => setConfirming(false)}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {link.expired ? null : (
            <>
              <View style={styles.action}>
                <Button
                  variant="secondary"
                  label={t("privateLinks.copy")}
                  accessibilityHint={status}
                  onPress={() => void handleCopy()}
                />
              </View>
              <View style={styles.action}>
                <Button
                  variant="secondary"
                  label={t("eventTypes.share")}
                  accessibilityHint={status}
                  onPress={() => shareLink(url)}
                />
              </View>
            </>
          )}
          <View style={styles.action}>
            <Button
              variant="secondary"
              label={t("privateLinks.delete")}
              accessibilityHint={status}
              onPress={() => setConfirming(true)}
            />
          </View>
        </View>
      )}
      {copied ? (
        <Text style={[styles.body, { color: colors.text }]}>{t("eventTypes.linkCopied")}</Text>
      ) : null}
      {remove.isError ? (
        <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>
          {actionErrorMessage(t, remove.error, {
            fallback: t("privateLinks.deleteFailed"),
            notFound: t("eventTypes.notFound"),
          })}
        </Text>
      ) : null}
    </View>
  );
}

/** An event type's private links, each with what stops it working, to copy, share or delete. */
export function PrivateLinksSection({ eventType }: { eventType: EventTypeSummary }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const account = useSignedInAccount();
  const router = useRouter();
  const links = usePrivateLinks(eventType.id);

  let content: ReactNode;
  if (links.isPending) {
    content = <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />;
  } else if (links.isLoadingError) {
    content = (
      <LoadErrorState
        error={links.error}
        onRetry={() => void links.refetch()}
        fallbackMessage={t("privateLinks.loadFailed")}
      />
    );
  } else if (links.data.length === 0) {
    content = <Text style={[styles.body, { color: colors.textMuted }]}>{t("privateLinks.none")}</Text>;
  } else {
    content = links.data.map((link) => (
      <PrivateLinkRow
        key={link.id}
        link={link}
        url={privateLinkUrl(account.serverOrigin, link.id, eventType.slug)}
        eventTypeId={eventType.id}
      />
    ));
  }

  return (
    <Section title={t("privateLinks.title")}>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t("privateLinks.intro")}</Text>
      {content}
      <View style={styles.newLink}>
        <Button
          variant="secondary"
          label={t("privateLinks.new.action")}
          onPress={() =>
            router.push({ pathname: "/event-type/[id]/private-link", params: { id: String(eventType.id) } })
          }
        />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  row: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
    gap: 4,
  },
  badgeLine: {
    flexDirection: "row",
  },
  confirm: {
    gap: 8,
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  action: {
    flex: 1,
  },
  newLink: {
    marginTop: 12,
  },
});
