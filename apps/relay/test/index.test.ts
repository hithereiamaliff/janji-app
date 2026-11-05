import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("the relay", () => {
  it("answers a health check", async () => {
    const response = await exports.default.fetch("https://relay.test/v1/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("answers anything else with a JSON 404", async () => {
    const response = await exports.default.fetch("https://relay.test/v1/nothing-here");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("has its database migrated", async () => {
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'devices'"
    ).all();

    expect(tables.results).toEqual([{ name: "devices" }]);
  });
});
