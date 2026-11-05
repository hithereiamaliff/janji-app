import type { Server } from "@/session/account";
import { checkServer, verifyApiKey } from "@/session/sign-in";

const server: Server = {
  serverOrigin: "https://book.example.com",
  apiRootUrl: "https://book.example.com/api",
};

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

describe("checkServer", () => {
  it("accepts a bare host name once Cal API v2 answers", async () => {
    const urls: string[] = [];
    const fetch = async (input: string) => {
      urls.push(input);
      return json({ status: "success", data: [] });
    };

    await expect(checkServer("book.example.com", { fetch })).resolves.toEqual({ ok: true, server });
    expect(urls).toEqual(["https://book.example.com/api/v2/timezones"]);
  });

  it("uses a separate API v2 address when one is given", async () => {
    const fetch = async () => json({ status: "success", data: [] });

    await expect(
      checkServer("book.example.com", { apiV2Address: "https://api.example.com/v2", fetch })
    ).resolves.toEqual({
      ok: true,
      server: { serverOrigin: "https://book.example.com", apiRootUrl: "https://api.example.com" },
    });
  });

  it("rejects plain HTTP without contacting the server", async () => {
    const fetch = jest.fn();

    await expect(checkServer("http://book.example.com", { fetch })).resolves.toEqual({
      ok: false,
      reason: "insecure",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an unusable API v2 address", async () => {
    await expect(checkServer("book.example.com", { apiV2Address: "ftp://api.example.com" })).resolves.toEqual(
      {
        ok: false,
        reason: "api_address_invalid",
      }
    );
  });

  it("explains when the server answers but isn't running Cal API v2", async () => {
    const fetch = async () => new Response("<!DOCTYPE html>", { status: 404 });

    await expect(checkServer("book.example.com", { fetch })).resolves.toEqual({
      ok: false,
      reason: "not_cal_api",
    });
  });
});

describe("verifyApiKey", () => {
  it("returns the account the key belongs to", async () => {
    const requests: Request[] = [];
    const fetch = async (request: Request) => {
      requests.push(request);
      return json({
        status: "success",
        data: {
          id: 7,
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
      });
    };

    await expect(verifyApiKey(server, "  cal_secret \n", { fetch })).resolves.toEqual({
      ok: true,
      account: {
        ...server,
        user: {
          id: 7,
          username: "alan",
          name: "Alan",
          email: "alan@example.com",
          timeZone: "Asia/Kuala_Lumpur",
        },
      },
    });
    expect(requests[0]?.url).toBe("https://book.example.com/api/v2/me");
    expect(requests[0]?.headers.get("Authorization")).toBe("Bearer cal_secret");
  });

  it("refuses an empty key without a request", async () => {
    const fetch = jest.fn();

    await expect(verifyApiKey(server, "   ", { fetch })).resolves.toMatchObject({
      ok: false,
      reason: "empty",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports a wrong, expired or deleted key as unauthorized", async () => {
    const fetch = async () =>
      json({ status: "error", error: { message: "Your api key is not valid" } }, { status: 401 });

    await expect(verifyApiKey(server, "cal_wrong", { fetch })).resolves.toMatchObject({
      ok: false,
      reason: "unauthorized",
    });
  });

  it("passes on how long to wait when rate limited", async () => {
    const fetch = async () =>
      json(
        { status: "error", error: { message: "Too Many Requests" } },
        { status: 429, headers: { "X-RateLimit-Reset-Default": "30" } }
      );

    await expect(verifyApiKey(server, "cal_secret", { fetch })).resolves.toEqual({
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: 30,
    });
  });

  it("reports a dropped connection as a network problem", async () => {
    const fetch = async (): Promise<Response> => {
      throw new TypeError("Network request failed");
    };

    await expect(verifyApiKey(server, "cal_secret", { fetch })).resolves.toMatchObject({
      ok: false,
      reason: "network",
    });
  });
});
