import { describe, expect, it } from "bun:test";

import { apiVersionFor } from "../api-versions";
import { API_VERSIONS } from "../generated/api-versions";

describe("apiVersionFor", () => {
  it.each([
    ["GET", "/v2/bookings", "2024-08-13"],
    ["POST", "/v2/bookings/{bookingUid}/reschedule", "2024-08-13"],
    // This operation states its version only in the header description, not as a default.
    ["PATCH", "/v2/bookings/{bookingUid}/location", "2024-08-13"],
    ["GET", "/v2/slots", "2024-09-04"],
    ["GET", "/v2/event-types", "2024-06-14"],
    ["GET", "/v2/schedules/default", "2024-06-11"],
    ["GET", "/v2/me", null],
    ["GET", "/v2/webhooks", null],
    // Sending 2024-06-14 here returns 404: the private links controller only answers the default version.
    ["GET", "/v2/event-types/{eventTypeId}/private-links", null],
  ])("%s %s → %p", (method, path, expected) => {
    expect(apiVersionFor(method, path)).toBe(expected);
  });

  it("accepts lower-case methods, as Request objects may report them", () => {
    expect(apiVersionFor("get", "/v2/bookings")).toBe("2024-08-13");
  });

  it("refuses operations that aren't in the spec instead of guessing", () => {
    expect(() => apiVersionFor("GET", "/v2/bookings/")).toThrow("not an operation");
    expect(() => apiVersionFor("GET", "/v2/teams")).toThrow("not an operation");
  });
});

describe("generated version map", () => {
  it("has an entry for every operation in the vendored spec", async () => {
    const spec = (await Bun.file(new URL("../../openapi/cal-diy-api-v2.json", import.meta.url)).json()) as {
      paths: Record<string, Record<string, unknown>>;
    };
    const methods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
    const operations = Object.entries(spec.paths).flatMap(([path, item]) =>
      Object.keys(item)
        .filter((method) => methods.has(method))
        .map((method) => `${method.toUpperCase()} ${path}`)
    );

    expect(Object.keys(API_VERSIONS).sort()).toEqual(operations.sort());
  });
});
