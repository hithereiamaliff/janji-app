import { deleteSecureItem, getSecureItem, setSecureItem } from "@/lib/secure-storage";

const REGISTRATION_KEY = "janji.notifications";

/**
 * How this phone gets the signed-in account's notifications: its device at the relay, and the Cal.diy
 * webhook that points there. It's kept in secure storage because the device token is what lets the app
 * change or remove the device.
 */
export type PushRegistration = {
  /** The account that turned notifications on. */
  serverOrigin: string;
  userId: number;
  relayOrigin: string;
  deviceId: string;
  deviceToken: string;
  webhookId: number;
  /** The push token and language the relay was last given, so a change can be sent on. */
  expoPushToken: string;
  locale: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRegistration(value: unknown): value is PushRegistration {
  return (
    isRecord(value) &&
    typeof value.serverOrigin === "string" &&
    typeof value.userId === "number" &&
    typeof value.relayOrigin === "string" &&
    typeof value.deviceId === "string" &&
    typeof value.deviceToken === "string" &&
    typeof value.webhookId === "number" &&
    typeof value.expoPushToken === "string" &&
    typeof value.locale === "string"
  );
}

function parseRegistration(json: string): PushRegistration | null {
  try {
    const value: unknown = JSON.parse(json);
    return isRegistration(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * The saved registration, or null. One that can't be read, such as after an interrupted save, can't change
 * or remove anything, so it's deleted.
 */
export async function loadPushRegistration(): Promise<PushRegistration | null> {
  const json = await getSecureItem(REGISTRATION_KEY);
  if (json === null) return null;
  const registration = parseRegistration(json);
  if (!registration) await deleteSecureItem(REGISTRATION_KEY);
  return registration;
}

export async function savePushRegistration(registration: PushRegistration): Promise<void> {
  await setSecureItem(REGISTRATION_KEY, JSON.stringify(registration));
}

export async function clearPushRegistration(): Promise<void> {
  await deleteSecureItem(REGISTRATION_KEY);
}
