import { describe, expect, it } from "bun:test";

import { createCalClient, unwrap } from "../client";
import { CalApiError } from "../errors";

const API_ROOT = "https://cal.example.com/api";
const API_KEY = "cal_live_0123456789abcdef";

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function fakeFetch(respond: (request: Request) => Response | Promise<Response>) {
  const requests: Request[] = [];
  const fetch = async (request: Request) => {
    requests.push(request.clone());
    return respond(request);
  };
  return { fetch, requests };
}

function clientWith(respond: (request: Request) => Response | Promise<Response>) {
  const { fetch, requests } = fakeFetch(respond);
  const cal = createCalClient({ apiRootUrl: API_ROOT, getApiKey: () => API_KEY, fetch });
  return { cal, requests };
}

const ME = {
  status: "success",
  data: {
    id: 1,
    username: "alan",
    email: "alan@example.com",
    name: "Alan",
    avatarUrl: null,
    bio: null,
    timeFormat: 12,
    defaultScheduleId: 1,
    weekStart: "Monday",
    timeZone: "Asia/Kuala_Lumpur",
    organizationId: null,
  },
};

describe("createCalClient requests", () => {
  it("sends the API key, a JSON Accept header and the operation's cal-api-version", async () => {
    const { cal, requests } = clientWith(() => json({ status: "success", data: [] }));

    await cal.GET("/v2/bookings", { params: { query: { take: 10 } } });

    const request = requests[0];
    expect(request?.url).toBe("https://cal.example.com/api/v2/bookings?take=10");
    expect(request?.headers.get("Authorization")).toBe(`Bearer ${API_KEY}`);
    expect(request?.headers.get("Accept")).toBe("application/json");
    expect(request?.headers.get("cal-api-version")).toBe("2024-08-13");
  });

  it("sends list filters comma-separated, as API v2 expects", async () => {
    const { cal, requests } = clientWith(() => json({ status: "success", data: [] }));

    await cal.GET("/v2/bookings", { params: { query: { status: ["upcoming", "unconfirmed"] } } });

    expect(new URL(requests[0]?.url ?? "").searchParams.getAll("status")).toEqual(["upcoming,unconfirmed"]);
  });

  it("sends no cal-api-version where the operation declares none", async () => {
    const { cal, requests } = clientWith(() => json({ status: "success", data: [] }));

    await cal.GET("/v2/me");
    await cal.GET("/v2/event-types/{eventTypeId}/private-links", { params: { path: { eventTypeId: 7 } } });

    expect(requests.map((request) => request.headers.get("cal-api-version"))).toEqual([null, null]);
    expect(requests[1]?.url).toBe("https://cal.example.com/api/v2/event-types/7/private-links");
  });

  it("reads the API key for every request, so a replaced key applies immediately", async () => {
    let apiKey: string | null = "cal_first";
    const { fetch, requests } = fakeFetch(() => json(ME));
    const cal = createCalClient({ apiRootUrl: API_ROOT, getApiKey: () => apiKey, fetch });

    await cal.GET("/v2/me");
    apiKey = "cal_second";
    await cal.GET("/v2/me");
    apiKey = null;
    await cal.GET("/v2/me");

    expect(requests.map((request) => request.headers.get("Authorization"))).toEqual([
      "Bearer cal_first",
      "Bearer cal_second",
      null,
    ]);
  });
});

describe("unwrap", () => {
  it("returns the typed body of a successful call", async () => {
    const { cal } = clientWith(() => json(ME));

    const me = unwrap(await cal.GET("/v2/me"));

    expect(me.data.timeZone).toBe("Asia/Kuala_Lumpur");
  });

  it("turns an API v2 error into a CalApiError with the server's message", async () => {
    const { cal } = clientWith(() =>
      json(
        { status: "error", error: { code: "UnauthorizedException", message: "Invalid API Key" } },
        { status: 401 }
      )
    );

    const error = await cal
      .GET("/v2/me")
      .then(unwrap)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CalApiError);
    expect(error).toMatchObject({ kind: "unauthorized", status: 401, serverMessage: "Invalid API Key" });
  });

  it("reports how long to wait when rate limited", async () => {
    const { cal } = clientWith(() =>
      json(
        { status: "error", error: { code: "ThrottlerException", message: "Too Many Requests" } },
        { status: 429, headers: { "X-RateLimit-Reset-Default": "42" } }
      )
    );

    const error = await cal
      .GET("/v2/me")
      .then(unwrap)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ kind: "rate_limited", status: 429, retryAfterSeconds: 42 });
  });

  it("recognises the web app's HTML 404 page as 'not Cal API v2'", async () => {
    const { cal } = clientWith(
      () =>
        new Response("<!DOCTYPE html><title>404</title>", {
          status: 404,
          headers: { "Content-Type": "text/html" },
        })
    );

    const error = await cal
      .GET("/v2/me")
      .then(unwrap)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ kind: "not_cal_api", status: 404 });
  });

  it("treats 5xx responses as server errors", async () => {
    const { cal } = clientWith(
      () => new Response("Bad Gateway", { status: 502, headers: { "Content-Type": "text/html" } })
    );

    const error = await cal
      .GET("/v2/me")
      .then(unwrap)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ kind: "server_error", status: 502 });
  });
});

describe("createCalClient failures without an API response", () => {
  it("reports a failed connection as a network error", async () => {
    const { cal } = clientWith(() => {
      throw new TypeError("Network request failed");
    });

    await expect(cal.GET("/v2/me")).rejects.toMatchObject({ kind: "network", status: null });
  });

  it("reports a successful non-JSON page (for example a captive portal) as 'not Cal API v2'", async () => {
    const { cal } = clientWith(
      () =>
        new Response("<html>Sign in to Wi-Fi</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
    );

    await expect(cal.GET("/v2/me")).rejects.toMatchObject({ kind: "not_cal_api", status: 200 });
  });

  it("keeps the API key out of error messages", async () => {
    const { cal } = clientWith(() =>
      json({ status: "error", error: { message: "Invalid API Key" } }, { status: 401 })
    );

    const error = await cal
      .GET("/v2/me")
      .then(unwrap)
      .catch((e: unknown) => e);

    expect(String(error)).not.toContain(API_KEY);
  });
});
