import createClient, { type Client } from "openapi-fetch";

import { API_VERSION_HEADER, apiVersionFor } from "./api-versions";
import { CalApiError, toCalApiError } from "./errors";
import type { paths } from "./generated/openapi";

export type CalClient = Client<paths>;

export type CalClientOptions = {
  /** The URL the spec's `/v2/...` paths are appended to, for example `https://cal.example.com/api`. */
  apiRootUrl: string;
  /** Read on every request, so a replaced key applies without rebuilding the client. */
  getApiKey: () => string | null | Promise<string | null>;
  fetch?: (request: Request) => Promise<Response>;
};

export function createCalClient({ apiRootUrl, getApiKey, fetch }: CalClientOptions): CalClient {
  const client = createClient<paths>({
    baseUrl: apiRootUrl.replace(/\/+$/, ""),
    fetch,
    // API v2 splits list filters on commas (?status=upcoming,past); repeated keys would reach it as an array.
    querySerializer: { array: { style: "form", explode: false } },
  });

  client.use({
    async onRequest({ request, schemaPath }) {
      const version = apiVersionFor(request.method, schemaPath);
      if (version === null) {
        request.headers.delete(API_VERSION_HEADER);
      } else {
        request.headers.set(API_VERSION_HEADER, version);
      }
      request.headers.set("Accept", "application/json");

      const apiKey = await getApiKey();
      if (apiKey) request.headers.set("Authorization", `Bearer ${apiKey}`);
      return request;
    },
    onResponse({ response }) {
      // openapi-fetch would otherwise throw a bare SyntaxError parsing, say, a captive portal's HTML page.
      const contentType = response.headers.get("Content-Type") ?? "";
      if (response.ok && response.status !== 204 && !contentType.includes("json")) {
        throw new CalApiError({ kind: "not_cal_api", status: response.status });
      }
    },
    onError({ error }) {
      return new CalApiError({ kind: "network", cause: error });
    },
  });

  return client;
}

type ApiResult<Data> = {
  data?: Data;
  error?: unknown;
  response: Response;
};

/** Returns the parsed body of a successful call, or throws a CalApiError describing why it failed. */
export function unwrap<Data>(result: ApiResult<Data>): Data {
  if (!result.response.ok) throw toCalApiError(result.response, result.error);
  if (result.data === undefined) {
    throw new CalApiError({ kind: "not_cal_api", status: result.response.status });
  }
  return result.data;
}
