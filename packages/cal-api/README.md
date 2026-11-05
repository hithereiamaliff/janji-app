# @janji/cal-api

A typed client for **Cal API v2** on self-hosted Cal.diy servers, generated from Cal.diy's OpenAPI spec.

```ts
import { createCalClient, unwrap } from "@janji/cal-api/client";

const cal = createCalClient({
  apiRootUrl: "https://book.example.com/api", // the spec's /v2/... paths are appended to this
  getApiKey: () => storedApiKey,
});
const me = unwrap(await cal.GET("/v2/me")); // typed body, or throws CalApiError
```

## Finding a server's API

```ts
import { probeCalApi } from "@janji/cal-api/probe";
import { apiRootUrlFromApiV2Address, defaultApiRootUrl, normalizeServerUrl } from "@janji/cal-api/server-url";

normalizeServerUrl("book.example.com/some/booking-link"); // { ok: true, url: "https://book.example.com" }
defaultApiRootUrl("https://book.example.com"); // "https://book.example.com/api"
apiRootUrlFromApiV2Address("https://api.example.com/v2"); // { ok: true, url: "https://api.example.com" }

await probeCalApi("https://book.example.com/api"); // { kind: "ok" } | "not_cal_api" | "unreachable" | "timeout"
```

- **HTTPS only.** Server addresses must use HTTPS, except `localhost`, `127.0.0.1` and `10.0.2.2` (the
  Android emulator's address for the host) during development.
- **The probe.** It calls `GET /v2/timezones`, which needs no API key. A server whose web app answers but
  doesn't route `/api/v2` comes back as `not_cal_api`.

## What the client handles

- **API key.** It sends `Authorization: Bearer <key>`, reading the key on every request.
- **API version.** It sends each operation's `cal-api-version` header (see `apiVersionFor`). Without the right
  value, API v2 silently answers from its oldest controllers. Lookups use the exact method and templated
  path, not a path prefix, and some operations (such as private links) must be called without the header.
- **List filters.** It sends them comma-separated (`?status=upcoming,past`), which is what API v2 parses.
- **Errors.** `CalApiError.kind` tells callers what went wrong: `unauthorized`, `rate_limited` (with
  `retryAfterSeconds`), `not_cal_api` (for example the web app's HTML 404 when `/api/v2` isn't routed),
  `network`, and so on. Messages never include the API key.

## The spec

`openapi/cal-diy-api-v2.json` comes from `calcom/cal.diy` (MIT) at the commit recorded in
`openapi/SOURCE.json`, which also stores its SHA-256. Don't edit the spec or `src/generated/` by hand:

```sh
bun run sync-openapi          # re-download the pinned commit and regenerate
bun run sync-openapi <sha>    # move the pin to another calcom/cal.diy commit
bun run generate              # regenerate from the vendored spec
bun run generate:check        # CI: fail if the generated files are stale
```

For the generated types, two things in the spec are adjusted:

- `Authorization` and `cal-api-version` are dropped as call parameters, because the client adds them.
- The spec reuses two operationIds on the legacy `/v2/calendars/{calendar}/event/{eventUid}` paths, so the
  duplicates are renamed.

The version map is built from the unmodified spec.
