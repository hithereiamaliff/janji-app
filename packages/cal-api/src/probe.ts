export type ProbeResult =
  | { kind: "ok" }
  /** Something answered, but not Cal API v2: usually the web app, because API v2 isn't deployed or routed. */
  | { kind: "not_cal_api"; status: number }
  | { kind: "unreachable"; cause: unknown }
  | { kind: "timeout" };

export type ProbeOptions = {
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
};

function isSuccessEnvelope(body: unknown): boolean {
  return typeof body === "object" && body !== null && "status" in body && body.status === "success";
}

/**
 * Checks that API v2 answers at the given root before asking for an API key. /v2/timezones needs no
 * authentication and is served for every cal-api-version, so any working API v2 returns its JSON envelope.
 */
export async function probeCalApi(apiRootUrl: string, options: ProbeOptions = {}): Promise<ProbeResult> {
  const doFetch = options.fetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);

  try {
    const response = await doFetch(`${apiRootUrl.replace(/\/+$/, "")}/v2/timezones`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return { kind: "not_cal_api", status: response.status };
    const body: unknown = await response.json().catch(() => null);
    return isSuccessEnvelope(body) ? { kind: "ok" } : { kind: "not_cal_api", status: response.status };
  } catch (cause) {
    return controller.signal.aborted ? { kind: "timeout" } : { kind: "unreachable", cause };
  } finally {
    clearTimeout(timer);
  }
}
