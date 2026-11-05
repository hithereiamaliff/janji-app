# Janji

**Janji** is an open-source mobile app (iOS and Android) for people who run their own
[Cal.diy](https://github.com/calcom/cal.diy) scheduling server. You enter your server's address, sign in with
an API key, and manage your bookings, event types and availability from your phone, with push notifications
for new, rescheduled and cancelled bookings.

"Janji" is Malay for a promise or an appointment (as in _janji temu_).

> **Status:** early development. The app is not in the App Store or Google Play yet.

Janji is an independent project. It is not made by or affiliated with Cal.com, Inc.

## Requirements for your server

Janji talks to your server's **Cal API v2** (`https://<your-server>/api/v2`). Cal API v2 is a separate
service next to the Cal.diy web app, so it may not be running on your server yet:
[docs/server-setup.md](./docs/server-setup.md) explains how to run it. What the app and its notification relay
keep is in [docs/privacy.md](./docs/privacy.md), and help with common problems in
[docs/support.md](./docs/support.md). You can also run your own relay:
[docs/self-host-relay.md](./docs/self-host-relay.md).

## Repository layout

```
apps/mobile/        Expo (React Native) app
apps/relay/         push notification relay (Cloudflare Worker)
packages/cal-api/   typed Cal API v2 client, generated from Cal.diy's OpenAPI spec
packages/shared/    types the app and the relay share
docs/               server setup, privacy, support, relay hosting and releases
```

## Development

You need [Bun](https://bun.sh) 1.4 or newer.

```sh
bun install          # install all workspaces
bun run mobile       # start the Expo dev server for the app
bun run check        # format and lint with Biome
bun run typecheck    # TypeScript in every workspace
bun run test         # unit tests in every workspace
```

The app uses [Expo](https://expo.dev) SDK 58 and Expo Router. Features that need native code, such as push
notifications, run in an Expo development build rather than Expo Go. [docs/release.md](./docs/release.md)
explains how to make one, and the store builds.

## License

[MIT](./LICENSE). The placeholder icons in `apps/mobile/assets` come from Expo's MIT-licensed project
template and will be replaced with Janji's own icon before release.
