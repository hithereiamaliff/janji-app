import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Janji",
  slug: "janji",
  scheme: "janji",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "digital.techmavie.janji",
  },
  android: {
    package: "digital.techmavie.janji",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-localization",
    "expo-web-browser",
    // Expo's push service puts notifications sent without a channel in "default", which the app names.
    ["expo-notifications", { defaultChannel: "default" }],
  ],
  extra: {
    // The relay that turns Cal.diy's webhooks into this build's notifications, such as
    // "https://relay.example". A build made without one, or without an EAS project, has no notifications.
    relayOrigin: process.env.JANJI_RELAY_ORIGIN,
  },
  experiments: {
    typedRoutes: true,
  },
});
