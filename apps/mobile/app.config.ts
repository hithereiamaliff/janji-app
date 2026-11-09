import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Janji",
  slug: "janji",
  owner: "techmavie-digital",
  scheme: "janji",
  version: "0.1.0",
  // An update only reaches builds of the same `version`, so raise it whenever native code or native config
  // changes. The fingerprint policy would do that by itself, but it hashes the config, and
  // GOOGLE_SERVICES_JSON (a secret file path on EAS Build, unset where updates are published) would make the
  // Android runtime versions differ.
  runtimeVersion: { policy: "appVersion" },
  updates: { url: "https://u.expo.dev/7bcb6277-d27f-423a-b1c9-c23585c80463" },
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "digital.techmavie.janji",
    config: {
      // Janji only uses the encryption built into iOS (HTTPS and the Keychain), which US export rules exempt,
      // so App Store Connect needn't ask about it for every build.
      usesNonExemptEncryption: false,
    },
    // Apple doesn't read every privacy manifest that comes inside the native libraries, so the app repeats the
    // reasons theirs give (expo-application, -constants, -file-system, -localization, -notifications and
    // React Native's).
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1", "0A2A.1", "3B52.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
      ],
    },
  },
  android: {
    package: "digital.techmavie.janji",
    adaptiveIcon: {
      backgroundColor: "#1D4ED8",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    // Firebase's file for Android notifications. EAS Build gives its path in a file environment variable, so
    // it isn't committed; without it, an Android build has no notifications.
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-localization",
    "expo-web-browser",
    [
      "expo-splash-screen",
      { backgroundColor: "#1D4ED8", image: "./assets/splash-icon.png", imageWidth: 200 },
    ],
    // Expo's push service puts notifications sent without a channel in "default", which the app names.
    ["expo-notifications", { defaultChannel: "default" }],
  ],
  extra: {
    // The relay that turns Cal.diy's webhooks into this build's notifications, such as
    // "https://relay.example". A build made without one, or without an EAS project, has no notifications.
    relayOrigin: process.env.JANJI_RELAY_ORIGIN,
    // Janji's own EAS project. A copy built under another Expo account puts its own project here, and its own
    // account in `owner`, because the phones' push tokens are issued for the project.
    eas: { projectId: "7bcb6277-d27f-423a-b1c9-c23585c80463" },
  },
  experiments: {
    typedRoutes: true,
  },
});
