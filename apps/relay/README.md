# Janji relay

A small Cloudflare Worker that turns Cal.diy webhooks into push notifications for the Janji app. Each phone
registers with the relay, and the app points a Cal.diy webhook at the phone's hook URL. The relay checks
each webhook's signature, sends a push through Expo and keeps nothing about the booking.

It runs on Workers with D1 for the devices it knows (`migrations/`). Its types for the app live in
`packages/shared`.

## Commands

```sh
bun run test       # Vitest inside the Workers runtime (Miniflare), with the migrations applied
bun run typecheck
bun run dev        # wrangler dev, on a local database
```

## Deploying

Deploying needs a Cloudflare account; the free plan is enough.

1. `bunx wrangler d1 create janji-relay` and `bunx wrangler kv namespace create DEDUPE`, then put the IDs
   they print in `wrangler.jsonc`.
2. `bunx wrangler d1 migrations apply janji-relay --remote`
3. `openssl rand -base64 32 | bunx wrangler secret put SECRETS_KEY`: the key webhook secrets are kept encrypted
   with. Keep a copy somewhere safe; without it, every phone has to register again.
4. `bun run deploy`

Nothing secret goes in this repository. For `bun run dev`, put a key of your own in `.dev.vars`
(`SECRETS_KEY=...`), which git ignores.

## Routes

- `POST /v1/devices` `{ expoPushToken, platform, locale }` registers a phone (201), or registers its push
  token again (200): the device and its hook URL stay the same and its credentials are new. At most 20 a
  minute from one address.
- `PATCH /v1/devices/{id}` `{ expoPushToken?, locale? }` and `DELETE /v1/devices/{id}`, with the device token
  as `Authorization: Bearer …`, change or remove a device (204).
- `POST /v1/devices/status` `{ deviceIds }` answers `{ known }`, the ones the relay still has (up to 100).
- `POST /v1/hooks/{id}` takes the device's Cal.diy webhooks: it checks `X-Cal-Signature-256` and that the
  webhook is less than ten minutes old, answers at once, and then sends the alert through Expo. The same
  alert isn't sent twice within ten minutes, and a recurring series sends one. An unknown device gets 410.
  Bodies are never stored or logged.

If the hook URL is on a custom domain behind Cloudflare's WAF or bot protection, exempt `/v1/hooks/*`:
Cal.diy can't answer a challenge.
