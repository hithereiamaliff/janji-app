import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { changedHereRecently } from "@/bookings/recent-changes";
import { useAccountKey } from "@/data/useAccountKey";

import { pushSetup } from "./push-setup";

type BookingNotification = { request: { content: { data?: Record<string, unknown> } } };

function dataText(notification: BookingNotification, key: string): string | null {
  const value = notification.request.content.data?.[key];
  return typeof value === "string" && value !== "" ? value : null;
}

/** The booking a notification is about, from the `bookingUid` the relay puts in its data. */
export function bookingUidOf(notification: BookingNotification): string | null {
  return dataText(notification, "bookingUid");
}

/**
 * How a notification shows while the app is open: quietly, without a banner, sound or a place in the list,
 * when it's about a booking the person just changed in Janji. A reschedule names the booking it replaced.
 */
export function presentationOf(notification: BookingNotification): Notifications.NotificationBehavior {
  const uids = [bookingUidOf(notification), dataText(notification, "rescheduledFrom")];
  const show = !uids.some((uid) => uid !== null && changedHereRecently(uid));
  return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
}

/**
 * While someone is signed in (`enabled`), opens the booking a tapped notification is about, also when the tap
 * started the app. A notification that arrives while the app is open refreshes bookings, and stays quiet when
 * it only echoes a change made in Janji.
 */
export function useBookingNotifications(enabled: boolean) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accountKey = useAccountKey();

  useEffect(() => {
    if (!enabled || !pushSetup()) return;
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => presentationOf(notification),
    });
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
