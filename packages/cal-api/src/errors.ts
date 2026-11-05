export type CalApiErrorKind =
  /** 401 or 498: the API key is missing, wrong, expired or deleted. */
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  /** 400 or 422: API v2 rejected the request body or parameters. */
  | "invalid_request"
  | "server_error"
  /** The response isn't Cal API v2 JSON, typically the web app's HTML 404 because /api/v2 isn't routed. */
  | "not_cal_api"
  /** No response at all: offline, DNS, TLS or connection failure. */
  | "network";

type CalApiErrorInit = {
  kind: CalApiErrorKind;
  status?: number | null;
  serverMessage?: string | null;
  retryAfterSeconds?: number | null;
  cause?: unknown;
};

export class CalApiError extends Error {
  readonly kind: CalApiErrorKind;
  readonly status: number | null;
  readonly serverMessage: string | null;
  readonly retryAfterSeconds: number | null;

  constructor({
    kind,
    status = null,
    serverMessage = null,
    retryAfterSeconds = null,
    cause,
  }: CalApiErrorInit) {
    const statusText = status === null ? "no response" : `HTTP ${status}`;
    super(`Cal API v2 request failed (${kind}, ${statusText})${serverMessage ? `: ${serverMessage}` : ""}`, {
      cause,
    });
    this.name = "CalApiError";
    this.kind = kind;
    this.status = status;
    this.serverMessage = serverMessage;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type CalApiErrorBody = {
  status: "error";
  error?: { message?: unknown };
};

function isCalApiErrorBody(body: unknown): body is CalApiErrorBody {
  return typeof body === "object" && body !== null && "status" in body && body.status === "error";
}

/**
 * What NestJS answers for errors API v2 has no filter for, such as the HttpError Cal.diy's booking code throws
 * ("Cancellation reason is required"): its fallback handler sends `{ statusCode, message }` instead of the
 * usual envelope.
 */
type NestErrorBody = {
  statusCode: number;
  message?: unknown;
};

function isNestErrorBody(body: unknown): body is NestErrorBody {
  return (
    typeof body === "object" && body !== null && "statusCode" in body && typeof body.statusCode === "number"
  );
}

function kindForStatus(status: number): CalApiErrorKind {
  if (status === 401 || status === 498) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "invalid_request";
}

// API v2's throttler reports seconds until the window resets as X-RateLimit-Reset-<LimitName>
// (e.g. X-RateLimit-Reset-Default); a standard Retry-After header is honoured too.
function retryAfterSecondsFrom(headers: Headers): number | null {
  let seconds: number | null = null;
  headers.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (lower !== "retry-after" && !lower.startsWith("x-ratelimit-reset-")) return;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) seconds = Math.max(seconds ?? 0, parsed);
  });
  return seconds;
}

export function toCalApiError(response: Response, body: unknown): CalApiError {
  const { status } = response;
  if (status >= 500) {
    return new CalApiError({ kind: "server_error", status });
  }
  let message: unknown;
  if (isCalApiErrorBody(body)) {
    message = body.error?.message;
  } else if (isNestErrorBody(body)) {
    message = body.message;
  } else {
    return new CalApiError({ kind: "not_cal_api", status });
  }
  return new CalApiError({
    kind: kindForStatus(status),
    status,
    serverMessage: typeof message === "string" ? message : null,
    retryAfterSeconds: status === 429 ? retryAfterSecondsFrom(response.headers) : null,
  });
}
