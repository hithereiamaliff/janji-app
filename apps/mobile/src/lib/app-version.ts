import Constants from "expo-constants";

/** The app's version, as app.config.ts gives it, or null where the config isn't available. */
export function appVersion(): string | null {
  return Constants.expoConfig?.version ?? null;
}
