export type UrlParseFailure = "empty" | "invalid" | "insecure";

export type UrlParseResult = { ok: true; url: string } | { ok: false; reason: UrlParseFailure };

// Plain HTTP is only accepted for local development: the device itself and the Android emulator's host.
const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "10.0.2.2"]);

function parseHttpUrl(input: string): { ok: true; url: URL } | { ok: false; reason: UrlParseFailure } {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };

  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (url.username || url.password || url.hostname === "") return { ok: false, reason: "invalid" };
  if (url.protocol === "http:") {
    return LOCAL_HTTP_HOSTS.has(url.hostname) ? { ok: true, url } : { ok: false, reason: "insecure" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "invalid" };
  return { ok: true, url };
}

/**
 * Turns what someone types for their server ("book.example.com", a pasted booking link, …) into the web
 * app's origin. Only the origin is kept, so a link to any page on the server works.
 */
export function normalizeServerUrl(input: string): UrlParseResult {
  const parsed = parseHttpUrl(input);
  return parsed.ok ? { ok: true, url: parsed.url.origin } : parsed;
}

/** Cal.diy serves API v2 under /api/v2 on the web app's origin, and the spec's paths already start with /v2. */
export function defaultApiRootUrl(serverOrigin: string): string {
  return `${serverOrigin.replace(/\/+$/, "")}/api`;
}

/**
 * For servers that run API v2 elsewhere: accepts its address with or without the trailing /v2
 * ("https://api.example.com/v2" or "https://api.example.com") and returns the root the spec's paths go on.
 */
export function apiRootUrlFromApiV2Address(input: string): UrlParseResult {
  const parsed = parseHttpUrl(input);
  if (!parsed.ok) return parsed;
  const path = parsed.url.pathname.replace(/\/+$/, "").replace(/\/v2$/, "");
  return { ok: true, url: `${parsed.url.origin}${path}` };
}
