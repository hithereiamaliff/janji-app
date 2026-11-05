import { describe, expect, it } from "bun:test";

import { CalApiError } from "../errors";
import { fetchCityTimeZones } from "../timezones";

function answering(response: () => Response) {
  const urls: string[] = [];
  const fetch = async (input: string) => {
    urls.push(input);
    return response();
  };
  return { fetch, urls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("fetchCityTimeZones", () => {
  it("lists Cal.diy's cities and their time zones, A to Z", async () => {
    const { fetch, urls } = answering(() =>
      json({
        status: "success",
        data: [
          { city: "Penang", timezone: "Asia/Kuala_Lumpur", pop: 708127 },
          { city: "London", timezone: "Europe/London", pop: 7556900 },
        ],
      })
    );

    expect(await fetchCityTimeZones("https://cal.example.com/api/", { fetch })).toEqual([
      { city: "London", timeZone: "Europe/London" },
      { city: "Penang", timeZone: "Asia/Kuala_Lumpur" },
    ]);
    expect(urls).toEqual(["https://cal.example.com/api/v2/timezones"]);
  });

  it("refuses an answer that isn't a list of cities", async () => {
    const { fetch } = answering(() => json({ status: "success", data: { cities: [] } }));

    const error = await fetchCityTimeZones("https://cal.example.com/api", { fetch }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CalApiError);
    expect(error).toMatchObject({ kind: "not_cal_api" });
  });

  it("says when the server couldn't be reached", async () => {
    const fetch = async () => {
      throw new TypeError("Network request failed");
    };

    const error = await fetchCityTimeZones("https://cal.example.com/api", { fetch }).catch((e: unknown) => e);

    expect(error).toMatchObject({ kind: "network" });
  });

  it("says when the server failed", async () => {
    const { fetch } = answering(() => json({ status: "error" }, 503));

    const error = await fetchCityTimeZones("https://cal.example.com/api", { fetch }).catch((e: unknown) => e);

    expect(error).toMatchObject({ kind: "server_error", status: 503 });
  });
});
