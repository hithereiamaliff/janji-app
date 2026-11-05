import type { CalClient } from "@janji/cal-api/client";

import type { Account } from "@/session/account";

/** Which account something is for: its server and user. */
type AccountRef = Pick<Account, "serverOrigin"> & { user: Pick<Account["user"], "id"> };

import { askPushPermission, getPushToken, type PushPermission, readPushPermission } from "./push";
import type { PushSetup } from "./push-setup";
import {
  chosenTriggers,
  clearPushRegistration,
  loadPushRegistration,
  type PushRegistration,
  savePushRegistration,
} from "./registration-storage";
import { createRelayClient, type RelayClient, RelayRequestError } from "./relay-client";
import {
  connectWebhook,
  disconnectWebhook,
  fetchRelayWebhooks,
  type HookTrigger,
  type HookWebhook,
  hookPrefix,
  setWebhookTriggers,
} from "./webhooks-api";

type RelayFor = (relayOrigin: string) => RelayClient;

// Turning notifications on and off, releasing them at sign-out and the start-up sync all read and change the
// saved registration, so they take turns: a sync still running as the person turns notifications off could
// otherwise bring them back.
let turn: Promise<unknown> = Promise.resolve();

function takeTurn<T>(work: () => Promise<T>): Promise<T> {
  const result = turn.then(work, work);
  turn = result.catch(() => undefined);
  return result;
}

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
export function turnOnNotifications(input: TurnOnInput): Promise<TurnOnResult> {
  return takeTurn(() => turnOn(input));
}

async function turnOn({
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
  relayFor?: RelayFor;
};

/**
 * Turns this phone's notifications off: the relay forgets the phone, then its Cal.diy webhook goes too. It
 * reads the registration as it runs, since the start-up sync may have changed it.
 */
export function turnOffNotifications(input: TurnOffInput): Promise<void> {
  return takeTurn(() => turnOff(input));
}

async function turnOff({ calClient, relayFor = createRelayClient }: TurnOffInput): Promise<void> {
  const registration = await loadPushRegistration();
  if (!registration) return;
  await relayFor(registration.relayOrigin).remove(registration);
  // Once the relay has forgotten the phone, nothing reaches it any more. A webhook left behind because
  // deleting it failed only gets 410 answers from the relay, and the next start deletes it.
  await disconnectWebhook(calClient, registration.webhookId).catch(() => undefined);
  await clearPushRegistration();
}

/**
 * Undoes this phone's notifications as the person signs out, while the API key can still delete the webhook.
 * Unless the relay confirms it forgot the device, the registration is kept, so the device can still be
 * removed later.
 */
export function releaseNotifications(
  calClient: CalClient,
  relayFor: RelayFor = createRelayClient
): Promise<void> {
  return takeTurn(() => release(calClient, relayFor));
}

async function release(calClient: CalClient, relayFor: RelayFor): Promise<void> {
  const registration = await loadPushRegistration();
  if (!registration) return;
  const [removed] = await Promise.allSettled([
    relayFor(registration.relayOrigin).remove(registration),
    disconnectWebhook(calClient, registration.webhookId),
  ]);
  if (removed.status === "fulfilled") await clearPushRegistration();
}

/** Changes which booking events notify this phone, on its webhook and in the saved registration. */
export function chooseNotificationEvents(
  calClient: CalClient,
  triggers: readonly HookTrigger[]
): Promise<void> {
  return takeTurn(async () => {
    const registration = await loadPushRegistration();
    if (!registration) return;
    await setWebhookTriggers(calClient, registration.webhookId, triggers);
    await savePushRegistration({ ...registration, triggers: [...triggers] });
  });
}

/** Whether a saved registration is the signed-in account's, rather than one left from another account. */
export function belongsTo(registration: PushRegistration, account: AccountRef): boolean {
  return registration.serverOrigin === account.serverOrigin && registration.userId === account.user.id;
}

// The relay's device IDs: 16 random bytes in base64url.
const DEVICE_ID = /^[\w-]{22}$/;

type SyncInput = {
  calClient: CalClient;
  setup: PushSetup;
  account: AccountRef;
  /** The phone's language now. */
  locale: string;
  relayFor?: RelayFor;
};

type ReconnectInput = {
  calClient: CalClient;
  relay: RelayClient;
  setup: PushSetup;
  registration: PushRegistration;
  expoPushToken: string;
  locale: string;
};

/**
 * Registers the phone with the relay again and points its webhook at the hook URL that gives. A device or
 * webhook this replaces is removed.
 */
async function reconnect({ calClient, relay, setup, registration, expoPushToken, locale }: ReconnectInput) {
  const device = await relay.register({ expoPushToken, platform: setup.platform, locale });
  // Registering gave the device new credentials, so they're kept before anything else can fail.
  const registered = {
    ...registration,
    deviceId: device.deviceId,
    deviceToken: device.deviceToken,
    expoPushToken,
    locale,
  };
  await savePushRegistration(registered);
  const webhookId = await connectWebhook(calClient, {
    hookUrl: device.hookUrl,
    secret: device.webhookSecret,
    triggers: chosenTriggers(registration),
  });
  await savePushRegistration({ ...registered, webhookId });
  if (device.deviceId !== registration.deviceId) await relay.remove(registration).catch(() => undefined);
  if (webhookId !== registration.webhookId) {
    await disconnectWebhook(calClient, registration.webhookId).catch(() => undefined);
  }
}

/** Whether the relay answered that the device is gone, or that its token or push token now belong to another. */
function needsRegistering(error: unknown): boolean {
  return (
    error instanceof RelayRequestError &&
    (error.status === 401 || error.status === 404 || error.status === 409)
  );
}

/**
 * Keeps notifications working, each time the app starts signed in:
 * - another account's registration, kept because signing out couldn't reach the relay, has its device removed;
 * - the account's webhooks for phones the relay no longer knows, as after an uninstall, are deleted, since
 *   Cal.diy would call them forever;
 * - this phone's registration follows a new push token or language, and is made again when its device or
 *   webhook is gone, as when the webhook was deleted on the web.
 */
export function syncNotifications(input: SyncInput): Promise<void> {
  return takeTurn(() => sync(input));
}

async function sync({
  calClient,
  setup,
  account,
  locale,
  relayFor = createRelayClient,
}: SyncInput): Promise<void> {
  let registration = await loadPushRegistration();
  if (registration && !belongsTo(registration, account)) {
    // That account's webhook can't be deleted with this one's key; once the relay forgets the device, it
    // only gets 410 answers.
    await relayFor(registration.relayOrigin).remove(registration);
    await clearPushRegistration();
    registration = null;
  }

  const relay = relayFor(setup.relayOrigin);
  const prefix = hookPrefix(setup.relayOrigin);
  const deviceOf = (webhook: HookWebhook) => webhook.subscriberUrl.slice(prefix.length);
  const webhooks = await fetchRelayWebhooks(calClient, setup.relayOrigin);
  const ids = [...new Set(webhooks.map(deviceOf).filter((id) => DEVICE_ID.test(id)))];
  const known = new Set(ids.length > 0 ? await relay.knownDevices(ids) : []);
  for (const webhook of webhooks) {
    if (!known.has(deviceOf(webhook))) await disconnectWebhook(calClient, webhook.id).catch(() => undefined);
  }

  // A registration with another relay keeps working through it; it isn't this build's to change.
  if (!registration || registration.relayOrigin !== setup.relayOrigin) return;
  if ((await readPushPermission()) !== "granted") return;
  const expoPushToken = await getPushToken(setup.projectId);
  const { deviceId, webhookId } = registration;
  const connected =
    known.has(deviceId) && webhooks.some((w) => w.id === webhookId && deviceOf(w) === deviceId);
  if (connected) {
    if (expoPushToken === registration.expoPushToken && locale === registration.locale) return;
    try {
      await relay.update(registration, { expoPushToken, locale });
      await savePushRegistration({ ...registration, expoPushToken, locale });
      return;
    } catch (error) {
      if (!needsRegistering(error)) throw error;
    }
  }
  await reconnect({ calClient, relay, setup, registration, expoPushToken, locale });
}
