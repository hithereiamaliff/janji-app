import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Each test file gets its own copy of the database, so the migrations run before every one.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
