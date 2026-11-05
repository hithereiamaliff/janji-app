import { describe, expect, it } from "bun:test";

import { probeCalApi } from "../probe";

const API_ROOT = "https://cal.example.com/api";

function respondWith(response: Response) {
  const urls: string[] = [];
  const fetch = async (input: string) => {
    urls.push(input);
    return response;
  };
  return { fetch, urls };
}

describe("probeCalApi", () => {
  it("reports ok when /v2/timezones returns API v2's success envelope", async () => {
    const { fetch, urls } = respondWith(Response.json({ status: "success", data: [] }));

    expect(await probeCalApi(API_ROOT, { fetch })).toEqual({ kind: "ok" });
    expect(urls).toEqual(["https://cal.example.com/api/v2/timezones"]);
  });

  it("reports the web app's 404 page as not Cal API v2", async () => {
    const { fetch } = respondWith(new Response("<!DOCTYPE html>", { status: 404 }));

    expect(await probeCalApi(API_ROOT, { fetch })).toEqual({ kind: "not_cal_api", status: 404 });
  });

  it("reports a 200 response without the envelope as not Cal API v2", async () => {
    const { fetch } = respondWith(new Response("<html>Welcome</html>", { status: 200 }));

    expect(await probeCalApi(API_ROOT, { fetch })).toEqual({ kind: "not_cal_api", status: 200 });
  });

  it("reports connection failures as unreachable", async () => {
    const fetch = async () => {
      throw new TypeError("Network request failed");
    };

    expect(await probeCalApi(API_ROOT, { fetch })).toMatchObject({ kind: "unreachable" });
  });

  it("gives up after the timeout", async () => {
    const fetch = (_input: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });

    expect(await probeCalApi(API_ROOT, { fetch, timeoutMs: 20 })).toEqual({ kind: "timeout" });
  });
});
