# Janji relay

A small Cloudflare Worker that turns Cal.diy webhooks into push notifications for the Janji app. Each phone
registers with the relay, and the app points a Cal.diy webhook at the phone's hook URL. The relay checks
each webhook's signature, sends a push through Expo and keeps nothing about the booking.

It runs on Workers with D1 for the devices it knows (`migrations/`). The routes arrive over the next
changes: devices, webhook intake, then sending and receipts.

## Commands

```sh
bun run test       # Vitest inside the Workers runtime (Miniflare), with the migrations applied
bun run typecheck
bun run dev        # wrangler dev, on a local database
```

## Deploying

Deploying needs a Cloudflare account; the free plan is enough.

1. `bunx wrangler d1 create janji-relay`, then put the database ID it prints in `wrangler.jsonc`.
2. `bunx wrangler d1 migrations apply janji-relay --remote`
3. `bun run deploy`

Nothing secret goes in this repository: secrets are set with `wrangler secret put` once they're needed.
