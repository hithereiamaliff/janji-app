import type { CalClient } from "@janji/cal-api/client";

import type { Account } from "@/session/account";

import { askPushPermission, getPushToken, type PushPermission } from "./push";
import type { PushSetup } from "./push-setup";
import { clearPushRegistration, type PushRegistration, savePushRegistration } from "./registration-storage";
import type { RelayClient } from "./relay-client";
import { connectWebhook, disconnectWebhook } from "./webhooks-api";

export type TurnOnResult =
  | { status: "on"; registration: PushRegistration }
  /** The phone didn't allow notifications, so nothing was registered. */
  | { status: "notAllowed"; permission: Exclude<PushPermission, "granted"> };

type TurnOnInput = {
  calClient: CalClient;
  relay: RelayClient;
  setup: PushSetup;
  account: Account;
  /** The phone's language, which notifications are written in. */
  locale: string;
  /** Names Android's notification channel. */
  channelName: string;
};

/**
 * Turns on notifications for this phone: asks to notify, registers the phone with the relay, points a Cal.diy
 * webhook at it, and saves the registration.
 */
export async function turnOnNotifications({
  calClient,
  relay,
  setup,
  account,
  locale,
  channelName,
}: TurnOnInput): Promise<TurnOnResult> {
  const permission = await askPushPermission(channelName);
  if (permission !== "granted") return { status: "notAllowed", permission };

  const expoPushToken = await getPushToken(setup.projectId);
  const device = await relay.register({ expoPushToken, platform: setup.platform, locale });
  let webhookId: number;
  try {
    webhookId = await connectWebhook(calClient, { hookUrl: device.hookUrl, secret: device.webhookSecret });
  } catch (error) {
    // No webhook points at the device, so it would never be sent anything.
    await relay.remove(device).catch(() => undefined);
    throw error;
  }

  const registration: PushRegistration = {
    serverOrigin: account.serverOrigin,
    userId: account.user.id,
    relayOrigin: setup.relayOrigin,
    deviceId: device.deviceId,
    deviceToken: device.deviceToken,
    webhookId,
    expoPushToken,
    locale,
  };
  await savePushRegistration(registration);
  return { status: "on", registration };
}

type TurnOffInput = {
  calClient: CalClient;
  /** The relay the phone registered with. */
  relay: RelayClient;
  registration: PushRegistration;
};

/** Turns this phone's notifications off: the relay forgets the phone, then its Cal.diy webhook goes too. */
export async function turnOffNotifications({ calClient, relay, registration }: TurnOffInput): Promise<void> {
  await relay.remove(registration);
  // Once the relay has forgotten the phone, nothing reaches it any more. A webhook left behind because
  // deleting it failed only gets 410 answers from the relay.
  await disconnectWebhook(calClient, registration.webhookId).catch(() => undefined);
  await clearPushRegistration();
}

/** Whether a saved registration is the signed-in account's, rather than one left from another account. */
export function belongsTo(registration: PushRegistration, account: Account): boolean {
  return registration.serverOrigin === account.serverOrigin && registration.userId === account.user.id;
}
