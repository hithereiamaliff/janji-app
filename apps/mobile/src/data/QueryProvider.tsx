import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";

import { useSession } from "@/session/SessionProvider";

import { createQueryClient, watchAppFocus } from "./query-client";

/** Provides the app's TanStack Query cache. Must sit inside SessionProvider. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const { session } = useSession();

  useEffect(() => watchAppFocus(), []);

  // Cached data belongs to the account that loaded it, so none of it survives a sign-out.
  useEffect(() => {
    if (session.status === "signedOut") queryClient.clear();
  }, [session.status, queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
