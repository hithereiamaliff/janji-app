import type { DevicePlatform } from "@janji/shared/relay";
import Constants from "expo-constants";
import { Platform } from "react-native";

/** What a build needs for notifications: the relay they come through, and the Expo project. */
export type PushSetup = {
  platform: DevicePlatform;
  /** Such as "https://relay.example". */
  relayOrigin: string;
  /** The EAS project that the phone's Expo push tokens belong to. */
  projectId: string;
};

type BuildInfo = {
  os: typeof Platform.OS;
  /** The app config's `extra`. */
  extra: unknown;
  /** The project EAS Build stamps into the builds it makes. */
  easProjectId: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function httpsOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** A build's push setup, or null: on web, and in builds made without a relay or an EAS project. */
export function readPushSetup({ os, extra, easProjectId }: BuildInfo): PushSetup | null {
  if (os !== "ios" && os !== "android") return null;
  if (!isRecord(extra)) return null;
  const relayOrigin = httpsOrigin(extra.relayOrigin);
  const configured = isRecord(extra.eas) ? extra.eas.projectId : undefined;
  const projectId = typeof configured === "string" && configured ? configured : easProjectId;
  if (!relayOrigin || typeof projectId !== "string" || !projectId) return null;
  return { platform: os, relayOrigin, projectId };
}

export function pushSetup(): PushSetup | null {
  return readPushSetup({
    os: Platform.OS,
    extra: Constants.expoConfig?.extra,
    easProjectId: Constants.easConfig?.projectId,
  });
}
