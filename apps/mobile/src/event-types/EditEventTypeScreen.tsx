import { useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { FilterTabs } from "@/components/FilterTabs";
import { FormScreen } from "@/components/FormScreen";
import { TextField } from "@/components/TextField";
import { actionErrorMessage } from "@/lib/action-error";
import { formatDuration } from "@/lib/duration";
import { useSignedInAccount } from "@/session/SessionProvider";
import { useTheme } from "@/theme/useTheme";

import { bookingLink, type EventTypeSummary, readableLink } from "./event-type";
import {
  checkEventTypeForm,
  type EventTypeForm,
  type FormErrors,
  formFor,
  NOTICE_UNITS,
  slugToSave,
} from "./event-type-form";
import { isSlugTakenError } from "./event-types-api";
import { useEventType, useEventTypes, useUpdateEventType } from "./useEventTypes";

/** FormScreen's side padding, which the tabs reach past to scroll edge to edge. */
const FORM_PADDING = 24;

function errorMessages(t: TFunction, errors: FormErrors) {
  return {
    title: errors.title ? t("eventTypes.edit.errors.titleMissing") : null,
    slug:
      errors.slug === "taken"
        ? t("eventTypes.edit.errors.slugTaken")
        : errors.slug
          ? t("eventTypes.edit.errors.slugMissing")
          : null,
    length: errors.length ? t("eventTypes.edit.errors.lengthInvalid") : null,
    notice: errors.notice ? t("eventTypes.edit.errors.noticeInvalid") : null,
  };
}

function EditForm({ eventType }: { eventType: EventTypeSummary }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const account = useSignedInAccount();
  const eventTypes = useEventTypes();
  const update = useUpdateEventType(eventType.id);
  // The event type as the form found it. If a refresh brings in a change made on the web meanwhile, settings
  // left alone here still match this, so saving doesn't put the old values back.
  const [original] = useState(eventType);
  const [form, setForm] = useState<EventTypeForm>(() => formFor(original));
  const [errors, setErrors] = useState<FormErrors>({});

  function change(patch: Partial<EventTypeForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/event-type/[id]", params: { id: String(original.id) } });
  }

  function handleSave() {
    const otherSlugs = (eventTypes.data ?? [])
      .filter((other) => other.id !== original.id)
      .map((other) => other.slug);
    const check = checkEventTypeForm(form, original, otherSlugs);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    if (Object.keys(check.changes).length === 0) {
      close();
      return;
    }
    update.mutate(check.changes, {
      onSuccess: () => {
        AccessibilityInfo.announceForAccessibility(t("eventTypes.edit.saved"));
        close();
      },
    });
  }

  const linkSlug = slugToSave(form, original);
  const link =
    readableLink(bookingLink(account.serverOrigin, account.user.username, linkSlug)) + (linkSlug ? "" : "…");
  const slugTaken = isSlugTakenError(update.error);
  const messages = errorMessages(t, slugTaken ? { ...errors, slug: "taken" } : errors);

  return (
    <FormScreen title={t("eventTypes.edit.title")}>
      <TextField
        label={t("eventTypes.edit.titleLabel")}
        value={form.title}
        onChangeText={(title) => change({ title })}
        error={messages.title}
        editable={!update.isPending}
      />
      <TextField
        label={t("eventTypes.edit.slugLabel")}
        hint={
          linkSlug && linkSlug !== original.slug
            ? t("eventTypes.edit.slugChangedHint", { link })
            : t("eventTypes.edit.slugHint", { link })
        }
        value={form.slug}
        onChangeText={(slug) => change({ slug })}
        error={messages.slug}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!update.isPending}
      />
      {original.lengthOptions.length > 0 ? (
        <View style={styles.group}>
          <Text style={[styles.label, { color: colors.text }]}>{t("eventTypes.edit.defaultLength")}</Text>
          <FilterTabs
            options={original.lengthOptions.map((minutes) => ({
              value: String(minutes),
              label: formatDuration(t, minutes),
            }))}
            value={String(form.lengthChoice)}
            onChange={(minutes) => change({ lengthChoice: Number(minutes) })}
            accessibilityLabel={t("eventTypes.edit.defaultLength")}
            containerPadding={FORM_PADDING}
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t("eventTypes.edit.lengthsOnWeb")}</Text>
        </View>
      ) : (
        <TextField
          label={t("eventTypes.edit.lengthLabel")}
          value={form.length}
          onChangeText={(length) => change({ length })}
          error={messages.length}
          keyboardType="number-pad"
          editable={!update.isPending}
        />
      )}
      <View style={styles.group}>
        <TextField
          label={t("eventTypes.edit.noticeLabel")}
          hint={t("eventTypes.edit.noticeHint")}
          value={form.noticeAmount}
          onChangeText={(noticeAmount) => change({ noticeAmount })}
          error={messages.notice}
          keyboardType="number-pad"
          editable={!update.isPending}
        />
        <FilterTabs
          options={NOTICE_UNITS.map((unit) => ({ value: unit, label: t(`eventTypes.edit.units.${unit}`) }))}
          value={form.noticeUnit}
          onChange={(noticeUnit) => change({ noticeUnit })}
          accessibilityLabel={t("eventTypes.edit.noticeUnitLabel")}
          containerPadding={FORM_PADDING}
        />
      </View>
      <TextField
        label={t("eventTypes.edit.descriptionLabel")}
        value={form.description}
        onChangeText={(description) => change({ description })}
        multiline
        textAlignVertical="top"
        editable={!update.isPending}
      />
      {update.isError && !slugTaken ? (
        <Text accessibilityRole="alert" style={[styles.hint, { color: colors.danger }]}>
          {actionErrorMessage(t, update.error, {
            fallback: t("eventTypes.edit.failed"),
            notFound: t("eventTypes.notFound"),
          })}
        </Text>
      ) : null}
      <Button label={t("eventTypes.edit.save")} loading={update.isPending} onPress={handleSave} />
      <Button
        variant="secondary"
        label={t("bookingActions.goBack")}
        disabled={update.isPending}
        onPress={close}
      />
    </FormScreen>
  );
}

export function EditEventTypeScreen({ id }: { id: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const eventType = useEventType(id);

  if (eventType.data) return <EditForm eventType={eventType.data} />;
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
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
});
