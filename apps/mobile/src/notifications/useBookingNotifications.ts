import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { useAccountKey } from "@/data/useAccountKey";

import { pushSetup } from "./push-setup";

type BookingNotification = { request: { content: { data?: Record<string, unknown> } } };

/** The booking a notification is about, from the `bookingUid` the relay puts in its data. */
export function bookingUidOf(notification: BookingNotification): string | null {
  const uid = notification.request.content.data?.bookingUid;
  return typeof uid === "string" && uid !== "" ? uid : null;
}

/**
 * While someone is signed in (`enabled`), opens the booking a tapped notification is about, also when the tap
 * started the app, and refreshes bookings when a notification arrives while the app is open.
 */
export function useBookingNotifications(enabled: boolean) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accountKey = useAccountKey();

  useEffect(() => {
    if (!enabled || !pushSetup()) return;
    function open(response: Notifications.NotificationResponse | null) {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const uid = bookingUidOf(response.notification);
      if (!uid) return;
      // Otherwise the same tap would open the booking again the next time the app starts.
      Notifications.clearLastNotificationResponse();
      router.push({ pathname: "/booking/[uid]", params: { uid } });
    }
    open(Notifications.getLastNotificationResponse());
    const taps = Notifications.addNotificationResponseReceivedListener(open);
    const arrivals = Notifications.addNotificationReceivedListener((notification) => {
      const uid = bookingUidOf(notification);
      if (!uid) return;
      void queryClient.invalidateQueries({ queryKey: ["bookings", accountKey] });
      void queryClient.invalidateQueries({ queryKey: ["booking", accountKey, uid] });
    });
    return () => {
      taps.remove();
      arrivals.remove();
    };
  }, [enabled, router, queryClient, accountKey]);
}
