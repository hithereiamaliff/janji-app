import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { TextField } from "@/components/TextField";
import { ThemedSwitch } from "@/components/ThemedSwitch";
import { actionErrorMessage } from "@/lib/action-error";
import { useTheme } from "@/theme/useTheme";

import { cancelBooking } from "./booking-actions";
import { useBooking } from "./useBooking";
import { useBookingAction } from "./useBookingAction";
import { useCloseBookingForm } from "./useCloseBookingForm";

export function CancelBookingScreen({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const close = useCloseBookingForm(uid);
  const booking = useBooking(uid);
  const cancel = useBookingAction(uid, cancelBooking);
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);
  const [includeLaterOccurrences, setIncludeLaterOccurrences] = useState(false);
  const attendee = booking.data?.attendees[0]?.name;

  function handleCancel() {
    // Cal.diy requires a reason from hosts unless the event type makes it optional, which the app can't see.
    if (!reason.trim()) {
      setReasonMissing(true);
      return;
    }
    cancel.mutate(
      { reason, includeLaterOccurrences },
      {
        onSuccess: () => {
          AccessibilityInfo.announceForAccessibility(t("bookingActions.cancelled"));
          close();
        },
      }
    );
  }

  return (
    <FormScreen
      title={t("bookingActions.cancelTitle")}
      description={
        attendee
          ? t("bookingActions.cancelDescription", { name: attendee })
          : t("bookingActions.cancelDescriptionNoName")
      }
    >
      <TextField
        label={t("bookingActions.cancelReasonLabel")}
        hint={t("bookingActions.cancelReasonHint")}
        error={reasonMissing ? t("bookingActions.cancelReasonMissing") : null}
        value={reason}
        onChangeText={(text) => {
          setReason(text);
          if (text.trim()) setReasonMissing(false);
        }}
        multiline
        textAlignVertical="top"
        editable={!cancel.isPending}
      />
      {booking.data?.isRecurring ? (
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>
            {t("bookingActions.cancelLaterOccurrences")}
          </Text>
          <ThemedSwitch
            accessibilityLabel={t("bookingActions.cancelLaterOccurrences")}
            value={includeLaterOccurrences}
            onValueChange={setIncludeLaterOccurrences}
            disabled={cancel.isPending}
          />
        </View>
      ) : null}
      {cancel.isError ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
          {actionErrorMessage(t, cancel.error, {
            fallback: t("bookingActions.cancelFailed"),
            notFound: t("bookingDetail.notFound"),
          })}
        </Text>
      ) : null}
      <Button
        variant="destructive"
        label={t("bookingActions.cancelSubmit")}
        loading={cancel.isPending}
        onPress={handleCancel}
      />
      <Button
        variant="secondary"
        label={t("bookingActions.keep")}
        disabled={cancel.isPending}
        onPress={close}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  // 48 pt keeps the switch's row an easy touch target.
  switchRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  switchLabel: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  error: {
    fontSize: 15,
    lineHeight: 21,
  },
});
