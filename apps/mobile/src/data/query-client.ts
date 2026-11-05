import { CalApiError } from "@janji/cal-api/errors";
import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

const MAX_RETRIES = 2;

/** Only failures that may pass on their own are retried; a rejected key or a missing booking won't. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  return error instanceof CalApiError && (error.kind === "network" || error.kind === "server_error");
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // An API key gets 120 requests a minute, so data counts as fresh for a minute instead of refetching
        // on every screen visit. Pull to refresh still fetches on demand.
        staleTime: 60_000,
        retry: shouldRetry,
      },
    },
  });
}

/**
 * Refetches stale data when the app comes back to the foreground. TanStack Query only listens for browser
 * focus events by itself, so native apps report AppState changes instead.
 */
export function watchAppFocus(): () => void {
  if (Platform.OS === "web") return () => undefined;
  const subscription = AppState.addEventListener("change", (status) => {
    focusManager.setFocused(status === "active");
  });
  return () => subscription.remove();
}
