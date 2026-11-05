import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, StyleSheet, Text } from "react-native";

import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { TextField } from "@/components/TextField";
import { useTheme } from "@/theme/useTheme";

import { actionErrorMessage } from "./action-error";
import { declineBooking } from "./booking-actions";
import { useBooking } from "./useBooking";
import { useBookingAction } from "./useBookingAction";
import { useCloseBookingForm } from "./useCloseBookingForm";

export function DeclineBookingScreen({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const close = useCloseBookingForm(uid);
  const booking = useBooking(uid);
  const decline = useBookingAction(uid, declineBooking);
  const [reason, setReason] = useState("");
  const attendee = booking.data?.attendees[0]?.name;

  function handleDecline() {
    decline.mutate(reason, {
      onSuccess: () => {
        AccessibilityInfo.announceForAccessibility(t("bookingActions.declined"));
        close();
      },
    });
  }

  return (
    <FormScreen
      title={t("bookingActions.declineTitle")}
      description={
        attendee
          ? t("bookingActions.declineDescription", { name: attendee })
          : t("bookingActions.declineDescriptionNoName")
      }
    >
      <TextField
        label={t("bookingActions.declineReasonLabel")}
        hint={t("bookingActions.declineReasonHint")}
        value={reason}
        onChangeText={setReason}
        multiline
        textAlignVertical="top"
        editable={!decline.isPending}
      />
      {decline.isError ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
          {actionErrorMessage(t, decline.error, t("bookingActions.declineFailed"))}
        </Text>
      ) : null}
      <Button
        variant="destructive"
        label={t("bookingActions.declineSubmit")}
        loading={decline.isPending}
        onPress={handleDecline}
      />
      <Button
        variant="secondary"
        label={t("bookingActions.goBack")}
        disabled={decline.isPending}
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
