import { CalApiError } from "./errors";

/** A city and the IANA time zone Cal.diy files it under, as its time zone picker offers them. */
export type CityTimeZone = { city: string; timeZone: string };

export type CityTimeZonesOptions = {
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
};

function isCityList(data: unknown): data is { city: string; timezone: string }[] {
  return (
    Array.isArray(data) &&
    data.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "city" in entry &&
        typeof entry.city === "string" &&
        "timezone" in entry &&
        typeof entry.timezone === "string"
    )
  );
}

/**
 * The cities Cal.diy offers time zones by, A to Z. The endpoint isn't in the vendored spec, so its answer is
 * checked here rather than typed: `{ status: "success", data: [{ city, timezone, pop }] }`.
 */
export async function fetchCityTimeZones(
  apiRootUrl: string,
  options: CityTimeZonesOptions = {}
): Promise<CityTimeZone[]> {
  const doFetch = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(`${apiRootUrl.replace(/\/+$/, "")}/v2/timezones`, {
      headers: { Accept: "application/json" },
    });
  } catch (cause) {
    throw new CalApiError({ kind: "network", cause });
  }
  if (response.status >= 500) throw new CalApiError({ kind: "server_error", status: response.status });
  const body: unknown = await response.json().catch(() => null);
  const data = typeof body === "object" && body !== null && "data" in body ? body.data : null;
  if (!response.ok || !isCityList(data))
    throw new CalApiError({ kind: "not_cal_api", status: response.status });
  return data
    .map(({ city, timezone }) => ({ city, timeZone: timezone }))
    .sort((a, b) => a.city.localeCompare(b.city));
}
