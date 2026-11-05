import { type CalClient, createCalClient } from "@janji/cal-api/client";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Account } from "./account";
import { clearSavedSession, loadSavedSession, saveSession } from "./account-storage";

export type SessionState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; account: Account };

export type SessionContextValue = {
  session: SessionState;
  /** A Cal API v2 client for the signed-in account, or null while signed out. */
  calClient: CalClient | null;
  signIn: (account: Account, apiKey: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  // The key lives in a ref rather than state so it never appears in React DevTools or in render props.
  const apiKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSavedSession()
      .then((saved) => {
        if (cancelled) return;
        apiKeyRef.current = saved?.apiKey ?? null;
        setSession(saved ? { status: "signedIn", account: saved.account } : { status: "signedOut" });
      })
      .catch(() => {
        // An unreadable Keychain/Keystore entry shouldn't trap the app on a loading screen.
        if (!cancelled) setSession({ status: "signedOut" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (account: Account, apiKey: string) => {
    await saveSession({ account, apiKey });
    apiKeyRef.current = apiKey;
    setSession({ status: "signedIn", account });
  }, []);

  const signOut = useCallback(async () => {
    // Remove the key from the device first: if that fails, staying signed in (and saying so) beats an app
    // that looks signed out but restores the old session on its next launch.
    await clearSavedSession();
    apiKeyRef.current = null;
    setSession({ status: "signedOut" });
  }, []);

  const apiRootUrl = session.status === "signedIn" ? session.account.apiRootUrl : null;
  const calClient = useMemo(
    () => (apiRootUrl ? createCalClient({ apiRootUrl, getApiKey: () => apiKeyRef.current }) : null),
    [apiRootUrl]
  );

  const value = useMemo(
    () => ({ session, calClient, signIn, signOut }),
    [session, calClient, signIn, signOut]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>.");
  return value;
}

/** For screens behind the sign-in guard, which only render while an account is signed in. */
export function useCalClient(): CalClient {
  const { calClient } = useSession();
  if (!calClient)
    throw new Error("useCalClient was called while signed out; use it only in signed-in screens.");
  return calClient;
}
