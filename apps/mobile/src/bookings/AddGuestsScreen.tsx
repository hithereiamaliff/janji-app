import { CalApiError } from "@janji/cal-api/errors";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, StyleSheet, Text } from "react-native";

import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { TextField } from "@/components/TextField";
import { useTheme } from "@/theme/useTheme";

import { actionErrorMessage } from "./action-error";
import { addGuests } from "./booking-actions";
import { checkGuestEmails, type GuestEmailsCheck } from "./guest-emails";
import { useBooking } from "./useBooking";
import { useBookingAction } from "./useBookingAction";
import { useCloseBookingForm } from "./useCloseBookingForm";

function checkMessage(t: TFunction, check: GuestEmailsCheck): string | null {
  if (check.ok) return null;
  switch (check.problem) {
    case "missing":
      return t("bookingActions.guestEmailsMissing");
    case "too_many":
      return t("bookingActions.guestEmailsTooMany");
    case "invalid":
      return t("bookingActions.guestEmailsInvalid", { emails: check.emails.join(", ") });
    case "already_attending":
      return t("bookingActions.guestEmailsAlreadyAttending", { emails: check.emails.join(", ") });
  }
}

function addGuestsErrorMessage(t: TFunction, error: unknown): string {
  // Cal.diy skips guests already on the booking or whose addresses it won't accept, and sends this key
  // only when that leaves nobody to add.
  if (error instanceof CalApiError && error.serverMessage === "emails_must_be_unique_valid") {
    return t("bookingActions.guestEmailsRejected");
  }
  return actionErrorMessage(t, error, t("bookingActions.addGuestsFailed"));
}

export function AddGuestsScreen({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const close = useCloseBookingForm(uid);
  const booking = useBooking(uid);
  const add = useBookingAction(uid, addGuests);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  function handleAdd() {
    const check = checkGuestEmails(text, booking.data?.attendees ?? []);
    if (!check.ok) {
      setProblem(checkMessage(t, check));
      return;
    }
    setProblem(null);
    add.mutate(
      check.emails.map((email) => ({ email })),
      {
        onSuccess: () => {
          AccessibilityInfo.announceForAccessibility(
            t("bookingActions.guestsAdded", { count: check.emails.length })
          );
          close();
        },
      }
    );
  }

  return (
    <FormScreen
      title={t("bookingActions.addGuestsTitle")}
      description={t("bookingActions.addGuestsDescription")}
    >
      <TextField
        label={t("bookingActions.guestEmailsLabel")}
        hint={t("bookingActions.guestEmailsHint")}
        error={problem}
        value={text}
        onChangeText={(value) => {
          setText(value);
          setProblem(null);
        }}
        multiline
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        editable={!add.isPending}
      />
      {add.isError ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
          {addGuestsErrorMessage(t, add.error)}
        </Text>
      ) : null}
      <Button label={t("bookingActions.addGuestsSubmit")} loading={add.isPending} onPress={handleAdd} />
      <Button
        variant="secondary"
        label={t("bookingActions.goBack")}
        disabled={add.isPending}
        onPress={close}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  error: {
    fontSize: 15,
    lineHeight: 21,
  },
});
