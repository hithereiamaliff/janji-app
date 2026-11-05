import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Whether the phone lets Janji notify: "granted"; "canAsk", when Janji may ask; or "blocked", when only the
 * phone's settings can allow it.
 */
export type PushPermission = "granted" | "canAsk" | "blocked";

type PermissionAnswer = Pick<Notifications.NotificationPermissionsStatus, "granted" | "canAskAgain"> & {
  ios?: { status: Notifications.IosAuthorizationStatus };
};

export function toPushPermission(status: PermissionAnswer): PushPermission {
  // iOS answers in more detail than `granted`: quiet ("provisional") permission still delivers notifications.
  const ios = status.ios?.status;
  if (ios !== undefined) {
    if (ios === Notifications.IosAuthorizationStatus.NOT_DETERMINED) return "canAsk";
    return ios === Notifications.IosAuthorizationStatus.DENIED ? "blocked" : "granted";
  }
  if (status.granted) return "granted";
  return status.canAskAgain ? "canAsk" : "blocked";
}

export async function readPushPermission(): Promise<PushPermission> {
  return toPushPermission(await Notifications.getPermissionsAsync());
}

// Expo's push service shows a notification sent without a channel in the "default" one, so that's the channel
// Janji names. Android 13 and later only ask for permission once the app has a channel.
const CHANNEL_ID = "default";

/** Asks the phone to let Janji notify, unless it already decided. `channelName` names the Android channel. */
export async function askPushPermission(channelName: string): Promise<PushPermission> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: channelName,
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await readPushPermission();
  if (current !== "canAsk") return current;
  // The relay never sets a badge, so Janji doesn't ask to.
  const answer = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return toPushPermission(answer);
}

/** The phone's Expo push token, which the relay sends notifications to. It needs permission and the network. */
export async function getPushToken(projectId: string): Promise<string> {
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}
