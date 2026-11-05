import { API_VERSIONS } from "./generated/api-versions";

export const API_VERSION_HEADER = "cal-api-version";

export type OperationKey = keyof typeof API_VERSIONS;

function isOperationKey(key: string): key is OperationKey {
  return Object.hasOwn(API_VERSIONS, key);
}

/**
 * The cal-api-version a request must carry, or null when it must be sent without one. API v2 quietly routes
 * a missing or unknown version to its oldest (2024-04-15) controllers, so a wrong value fails in confusing
 * ways; lookups use the exact method and templated path from the spec rather than a path prefix.
 */
export function apiVersionFor(method: string, schemaPath: string): string | null {
  const key = `${method.toUpperCase()} ${schemaPath}`;
  if (!isOperationKey(key)) {
    throw new Error(`"${key}" is not an operation in the vendored Cal API v2 spec.`);
  }
  return API_VERSIONS[key];
}
