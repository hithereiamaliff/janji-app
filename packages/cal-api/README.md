# @janji/cal-api

TypeScript types and per-operation API versions for **Cal API v2** on self-hosted Cal.diy servers,
generated from Cal.diy's OpenAPI spec.

```ts
import { apiVersionFor } from "@janji/cal-api/api-versions";
import type { paths } from "@janji/cal-api/schema";

apiVersionFor("GET", "/v2/bookings"); // "2024-08-13"
apiVersionFor("GET", "/v2/event-types/{eventTypeId}/private-links"); // null: send no header
```

Every Cal API v2 request needs the right `cal-api-version` header. Without it, API v2 silently answers from
its oldest controllers. Lookups use the exact method and templated path, not a path prefix, and some
operations (such as private links) must be called without the header at all.

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
