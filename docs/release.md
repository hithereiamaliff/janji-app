# Building and releasing Janji

Janji's iOS and Android apps are built with [EAS Build](https://docs.expo.dev/build/introduction/), Expo's
cloud build service, so no Mac or Android Studio is needed. This guide covers the one-off setup, then the three
kinds of build. Run the commands in `apps/mobile`.

## What you need

- An **Expo account** (free).
- The **Apple Developer Program** ($99 a year), for iOS builds, TestFlight and iOS notifications.
- A **Google Play Console** account ($25 once).
- A **Firebase project**, which Android notifications go through.
- The **relay**, deployed: see [`apps/relay/README.md`](../apps/relay/README.md).

## One-off setup

1. **The EAS project.** `app.config.ts` holds Janji's own project, in `owner` and `extra.eas.projectId`. To build a
   copy under your own Expo account, run `bunx eas-cli init`, then put your account and the project ID it prints
   in place of those two. The app config is TypeScript, which EAS CLI can't edit.

   On a server you reach over SSH, sign in with an [access token](https://expo.dev/settings/access-tokens) in
   `EXPO_TOKEN` rather than `bunx eas-cli login`, whose browser sign-in returns to `localhost` on the server.

   The project ID isn't a secret: the phones' push tokens are issued for it.

2. **The relay's address**, which the builds send notifications through. Without it, a build has no
   notifications. Set it for each environment the build profiles use (`development`, `preview` and
   `production`):

   ```sh
   bunx eas-cli env:set --name JANJI_RELAY_ORIGIN --value https://<your relay> --environment production --visibility plaintext
   ```

3. **iOS notifications.** Run `bunx eas-cli credentials`, choose iOS, and set up push notifications. EAS can
   make the push key with your Apple account.

4. **Android notifications.**
   - In Firebase, add an Android app with the package name `digital.techmavie.janji` and download its
     `google-services.json`.
   - On expo.dev, under the project's environment variables, add that file as a **file** variable named
     `GOOGLE_SERVICES_JSON`, for all three environments.
   - Upload an FCM V1 service account key: `bunx eas-cli credentials`, then Android, production, Google
     Service Account, and the key for push notifications (FCM V1). Expo's guide:
     [Obtain Google Service Account Keys using FCM V1](https://docs.expo.dev/push-notifications/fcm-credentials/).

   Neither file belongs in the repository; `.gitignore` keeps them out.

5. **Building from GitHub** (optional). Add an access token from expo.dev as the `EXPO_TOKEN` repository
   secret. The **EAS build** workflow in the Actions tab then starts a build for a chosen profile and
   platform.

## The three builds

| Profile       | What it's for                                                                                                                                                                                    | Command                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `development` | Testing on your own phone with Expo's developer tools. It loads the app from `bun run mobile` on your computer. Expo Go can't receive notifications, so this is how to test them before release. | `bunx eas-cli build --profile development --platform ios` |
| `preview`     | A release-like build to install from a link, for you and testers.                                                                                                                                | `bunx eas-cli build --profile preview --platform android` |
| `production`  | Builds for the App Store and Google Play. EAS counts the build numbers up.                                                                                                                       | `bunx eas-cli build --profile production --platform all`  |

iPhones need registering before they can install `development` and `preview` builds: `bunx eas-cli device:create`.

A production build goes to the stores with `bunx eas-cli submit --platform ios` or `--platform android`.

## Updates without a new build

Changes to JavaScript, text and images reach the installed apps over the air with
[Expo Update](https://docs.expo.dev/eas-update/introduction/), without a new build. Each build profile listens
on the channel of the same name:

```sh
bunx eas-cli update --channel production --environment production --message "What changed"
```

- Pass `--environment`, so the update carries `JANJI_RELAY_ORIGIN` the way a build does.
- An app downloads an update when it starts, and runs it the next time it opens.
- An update only reaches builds of the same app `version`. After adding or upgrading a native module, or
  changing native config such as icons, permissions or plugins, raise `version` in `app.config.ts` and make
  new builds. Otherwise an update could reach a build that lacks the native code it needs.

## Before the first store release

- Make the repository public: the app links to its source code, and the listings to its support and privacy
  pages.
- Review [`privacy.md`](./privacy.md) and [`support.md`](./support.md), which the store listings link to.
- Fill in the listings and the stores' privacy forms from [`store-listing.md`](./store-listing.md).
