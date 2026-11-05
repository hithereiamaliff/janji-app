declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
  }

  interface GlobalProps {
    // Types `exports` from "cloudflare:workers", which the tests call the Worker through.
    mainModule: typeof import("./index");
  }
}
