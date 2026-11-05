# Janji: guide for AI agents

Janji is an open-source (MIT) Expo / React Native app for self-hosted Cal.diy servers. It talks to the
server's Cal API v2 with a user-supplied API key. Push notifications go through a small relay (Cloudflare
Worker) that turns Cal.diy webhooks into Expo push notifications.

## Layout

- `apps/mobile/`: the Expo app. Routes live in `src/app/` (Expo Router); everything else in `src/` outside it.
- `apps/relay/`: the push relay (added later).
- `packages/`: shared workspace packages (added later), for example the generated Cal API v2 client.

Read `apps/mobile/AGENTS.md` before touching Expo or React Native APIs: Expo SDK 58 differs from older
SDKs, so check the versioned docs instead of relying on memory.

## Commands (run from the repo root)

```sh
bun install
bun run check       # Biome format + lint (writes fixes)
bun run check:ci    # Biome, read-only, as in CI
bun run typecheck
bun run test
```

In `apps/mobile`, add dependencies with `bun expo install <package>` so versions match the Expo SDK, and
check the web bundle with `bunx expo export --platform web`.

## Conventions

- TypeScript strict. Use `import type` for types. No `any` and no `as any`.
- Every user-facing string goes through i18next (`apps/mobile/src/i18n/locales/en.json`). No hardcoded text.
- Accessibility: buttons and links get `accessibilityRole` and a translated `accessibilityLabel`; screen
  titles use `accessibilityRole="header"`.
- Dates: `date-fns`, `@date-fns/tz` or `Intl`. No Day.js or Moment.
- Secrets: API keys and relay tokens are stored only through `src/lib/secure-storage` (Keychain/Keystore).
  Never log them, and never log or store webhook payloads in the relay.
- Comments explain why, not what.
- Tests use `jest-expo` with React Native Testing Library 14 (`await render(...)`). Put them in
  `__tests__` folders, never inside `src/app/`.

## Git and pull requests

- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- One plan step per pull request, opened as a draft. Keep each under about 500 changed lines, not counting
  lockfiles and generated files.
- Run `bun run check:ci`, `bun run typecheck` and `bun run test` before pushing.
- Never commit `.env` files, API keys, signing keys or store credentials.
