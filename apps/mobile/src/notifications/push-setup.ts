import type { DevicePlatform } from "@janji/shared/relay";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { loadRelayChoice, relayOriginFrom } from "./relay-setting";

/** What this build of the app brings to notifications. */
export type PushBuild = {
  platform: DevicePlatform;
  /** The EAS project that the phone's Expo push tokens belong to. */
  projectId: string;
  /** The relay the build was made with, such as "https://relay.example", if it has one. */
  relayOrigin: string | null;
};

/** What notifications need: the build's platform and project, and the relay they come through. */
export type PushSetup = PushBuild & { relayOrigin: string };

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

/** A build's notification setup, or null: on web, and in builds made without an EAS project. */
export function readPushBuild({ os, extra, easProjectId }: BuildInfo): PushBuild | null {
  if (os !== "ios" && os !== "android") return null;
  const config = isRecord(extra) ? extra : {};
  const configured = isRecord(config.eas) ? config.eas.projectId : undefined;
  const projectId = typeof configured === "string" && configured ? configured : easProjectId;
  if (typeof projectId !== "string" || !projectId) return null;
  return { platform: os, projectId, relayOrigin: relayOriginFrom(config.relayOrigin) };
}

export function pushBuild(): PushBuild | null {
  return readPushBuild({
    os: Platform.OS,
    extra: Constants.expoConfig?.extra,
    easProjectId: Constants.easConfig?.projectId,
  });
}

/**
 * What notifications go through now: the relay chosen under Advanced, or else the build's. Null without a
 * build that can have notifications, or without a relay.
 */
export async function loadPushSetup(): Promise<PushSetup | null> {
  const build = pushBuild();
  if (!build) return null;
  const relayOrigin = (await loadRelayChoice()) ?? build.relayOrigin;
  return relayOrigin ? { ...build, relayOrigin } : null;
}
