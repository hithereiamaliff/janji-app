import { CalApiError } from "@janji/cal-api/errors";

import { shouldRetry } from "@/data/query-client";

describe("shouldRetry", () => {
  it.each(["network", "server_error"] as const)("retries %s failures up to twice", (kind) => {
    const error = new CalApiError({ kind });

    expect(shouldRetry(0, error)).toBe(true);
    expect(shouldRetry(1, error)).toBe(true);
    expect(shouldRetry(2, error)).toBe(false);
  });

  it.each(["unauthorized", "not_found", "invalid_request", "rate_limited", "not_cal_api"] as const)(
    "doesn't retry %s failures",
    (kind) => {
      expect(shouldRetry(0, new CalApiError({ kind }))).toBe(false);
    }
  );

  it("doesn't retry errors that didn't come from the API", () => {
    expect(shouldRetry(0, new TypeError("Cannot read properties of undefined"))).toBe(false);
  });
});
