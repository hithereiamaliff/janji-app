import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  // Read in Node, then applied inside the Workers runtime before the tests (test/apply-migrations.ts).
  const migrations = await readD1Migrations("./migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            // A key for tests only; a deployed relay gets its own with `wrangler secret put SECRETS_KEY`.
            SECRETS_KEY: "amFuamktcmVsYXktdGVzdC1rZXktMzItYnl0ZXMtISE=",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
