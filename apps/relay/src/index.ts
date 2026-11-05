import { Hono } from "hono";

import { devices } from "./devices";
import { checkReceipts } from "./expo";
import { hooks } from "./hooks";

const app = new Hono<{ Bindings: Cloudflare.Env }>();

app.get("/v1/health", (c) => c.json({ ok: true }));
app.route("/v1/devices", devices);
app.route("/v1/hooks", hooks);

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default {
  fetch: app.fetch,
  // Every 15 minutes (wrangler.jsonc), Expo's receipts say which phones can't be reached any more.
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(checkReceipts(env));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
