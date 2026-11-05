declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    /** 32 random bytes in base64, which webhook secrets are encrypted with. Set with `wrangler secret put`. */
    SECRETS_KEY: string;
    REGISTER_LIMIT: RateLimit;
  }

  interface GlobalProps {
    // Types `exports` from "cloudflare:workers", which the tests call the Worker through.
    mainModule: typeof import("./index");
  }
}
