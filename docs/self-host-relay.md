# Running your own notification relay

Janji's notifications go through a relay: a small service that takes your Cal.diy server's webhooks and passes
them to Expo's push service, which delivers them to your phone. The relay is open source, like the app, and
runs on Cloudflare Workers. You can run your own instead of the one Janji's builds use, so that your
notifications never pass through someone else's service.

## How it fits together

1. When you turn notifications on, the app registers the phone with the relay and gets a hook URL.
2. The app adds a webhook to your Cal.diy account that points at that URL, signed with a secret only your
   server and the relay know.
3. When a booking changes, your server calls the webhook. The relay checks the signature, writes the
   notification and sends it through Expo, then forgets the booking.

So the relay needs to be reachable from your Cal.diy server, and the app needs to know the relay's address.

## Deploying it

Follow [`apps/relay/README.md`](../apps/relay/README.md). It needs a Cloudflare account; the free plan's
100,000 requests a day is far more than a person's bookings need. In short: create the D1 database and the KV
namespace, apply the migrations, set the `SECRETS_KEY` secret, and run `bun run deploy`.

If you put the relay on your own domain behind Cloudflare's firewall or bot protection, exempt `/v1/hooks/*`.
Your server's webhooks can't answer a challenge.

## Pointing the app at it

In Janji, open **Settings**, choose **Show notification relay** under Notifications, enter your relay's address
and choose **Use this relay**. If booking notifications are on, turn them off first: a phone stays with the relay
it was turned on with. **Use Janji's relay again** goes back.

Your relay sends to the push tokens of Janji's own builds as long as Janji's EAS project leaves Expo's enhanced
push security off, which is the default. You can also build your own copy of the app with `JANJI_RELAY_ORIGIN`
set to your relay, as [`release.md`](./release.md) describes. A copy with its own EAS project issues its own push
tokens, and your relay sends to them.

## Expo's enhanced push security

Expo projects can require an access token for every push ("enhanced push security", off by default). If you build
your own copy of the app and turn it on for that EAS project, give the relay one of your Expo access tokens:

```sh
bunx wrangler secret put EXPO_ACCESS_TOKEN
```

Without it, Expo refuses the relay's pushes once enhanced security is on.

## What it keeps

The relay keeps each phone's push token, platform and language, a hash of the token the app proves it owns
the phone with, and the encrypted webhook secret, plus Expo's ticket IDs for up to a day. It never stores or
logs a booking. [What Janji keeps, and where](./privacy.md) has the details.
