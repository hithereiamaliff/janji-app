import { Hono } from "hono";

import { devices } from "./devices";

const app = new Hono<{ Bindings: Cloudflare.Env }>();

app.get("/v1/health", (c) => c.json({ ok: true }));
app.route("/v1/devices", devices);

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default app;
