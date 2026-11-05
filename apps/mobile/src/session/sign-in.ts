import { createCalClient, unwrap } from "@janji/cal-api/client";
import { CalApiError } from "@janji/cal-api/errors";
import { type ProbeOptions, probeCalApi } from "@janji/cal-api/probe";
import { apiRootUrlFromApiV2Address, defaultApiRootUrl, normalizeServerUrl } from "@janji/cal-api/server-url";

import type { Account, Server } from "./account";

export type ServerCheckFailure =
  | "empty"
  | "invalid"
  | "insecure"
  | "api_address_invalid"
  | "not_cal_api"
  | "unreachable"
  | "timeout";

export type ServerCheckResult = { ok: true; server: Server } | { ok: false; reason: ServerCheckFailure };

export type ServerCheckOptions = {
  /** Only for servers that run API v2 on another address; usually left empty. */
  apiV2Address?: string;
  fetch?: ProbeOptions["fetch"];
};

/** Turns the typed server address into a Server, after checking that Cal API v2 answers there. */
export async function checkServer(
  serverInput: string,
  options: ServerCheckOptions = {}
): Promise<ServerCheckResult> {
  const origin = normalizeServerUrl(serverInput);
  if (!origin.ok) return { ok: false, reason: origin.reason };

  let apiRootUrl = defaultApiRootUrl(origin.url);
  const apiV2Address = options.apiV2Address?.trim();
  if (apiV2Address) {
    const custom = apiRootUrlFromApiV2Address(apiV2Address);
    if (!custom.ok) return { ok: false, reason: "api_address_invalid" };
    apiRootUrl = custom.url;
  }

  const probe = await probeCalApi(apiRootUrl, { fetch: options.fetch });
  if (probe.kind !== "ok") return { ok: false, reason: probe.kind };
  return { ok: true, server: { serverOrigin: origin.url, apiRootUrl } };
}

export type KeyCheckFailure =
  | "empty"
  | "unauthorized"
  | "rate_limited"
  | "not_cal_api"
  | "network"
  | "server_error"
  | "unexpected";

export type KeyCheckResult =
  | { ok: true; account: Account }
  | { ok: false; reason: KeyCheckFailure; retryAfterSeconds: number | null };

function keyCheckFailure(reason: KeyCheckFailure, retryAfterSeconds: number | null = null): KeyCheckResult {
  return { ok: false, reason, retryAfterSeconds };
}

/** Checks an API key by loading the profile it belongs to, and returns the account to sign in with. */
export async function verifyApiKey(
  server: Server,
  apiKeyInput: string,
  options: { fetch?: (request: Request) => Promise<Response> } = {}
): Promise<KeyCheckResult> {
  const apiKey = apiKeyInput.trim();
  if (apiKey === "") return keyCheckFailure("empty");

  const cal = createCalClient({
    apiRootUrl: server.apiRootUrl,
    getApiKey: () => apiKey,
    fetch: options.fetch,
  });
  try {
    const me = unwrap(await cal.GET("/v2/me")).data;
    return {
      ok: true,
      account: {
        ...server,
        user: { id: me.id, username: me.username, name: me.name, email: me.email, timeZone: me.timeZone },
      },
    };
  } catch (error) {
    if (!(error instanceof CalApiError)) throw error;
    switch (error.kind) {
      case "unauthorized":
      case "forbidden":
        return keyCheckFailure("unauthorized");
      case "rate_limited":
        return keyCheckFailure("rate_limited", error.retryAfterSeconds);
      case "not_cal_api":
      case "network":
      case "server_error":
        return keyCheckFailure(error.kind);
      default:
        return keyCheckFailure("unexpected");
    }
  }
}
