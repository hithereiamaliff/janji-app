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

import type { Account, AccountUser } from "./account";
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
  /** Replaces the signed-in person's details, such as after their profile changed, and saves them. */
  updateUser: (user: AccountUser) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

// How long signing out waits for `beforeSignOut`, so a slow or missing connection doesn't hold it up.
const BEFORE_SIGN_OUT_MS = 5000;

async function atMost(ms: number, work: Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  try {
    await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

type SessionProviderProps = {
  children: ReactNode;
  /**
   * Runs when the person signs out, while the API key still works, such as to undo this phone's
   * notifications. Signing out waits a few seconds for it at most, and goes ahead if it fails.
   */
  beforeSignOut?: (client: CalClient) => Promise<void>;
};

export function SessionProvider({ children, beforeSignOut }: SessionProviderProps) {
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

  const apiRootUrl = session.status === "signedIn" ? session.account.apiRootUrl : null;
  const calClient = useMemo(
    () => (apiRootUrl ? createCalClient({ apiRootUrl, getApiKey: () => apiKeyRef.current }) : null),
    [apiRootUrl]
  );

  const signIn = useCallback(async (account: Account, apiKey: string) => {
    await saveSession({ account, apiKey });
    apiKeyRef.current = apiKey;
    setSession({ status: "signedIn", account });
  }, []);

  const signOut = useCallback(async () => {
    if (calClient && beforeSignOut)
      await atMost(
        BEFORE_SIGN_OUT_MS,
        beforeSignOut(calClient).catch(() => undefined)
      );
    // Remove the key from the device first: if that fails, staying signed in (and saying so) beats an app
    // that looks signed out but restores the old session on its next launch.
    await clearSavedSession();
    apiKeyRef.current = null;
    setSession({ status: "signedOut" });
  }, [calClient, beforeSignOut]);

  const updateUser = useCallback(
    async (user: AccountUser) => {
      const apiKey = apiKeyRef.current;
      if (session.status !== "signedIn" || !apiKey) return;
      const account = { ...session.account, user };
      await saveSession({ account, apiKey });
      setSession({ status: "signedIn", account });
    },
    [session]
  );

  const value = useMemo(
    () => ({ session, calClient, signIn, signOut, updateUser }),
    [session, calClient, signIn, signOut, updateUser]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>.");
  return value;
}

/** The signed-in account, for screens behind the sign-in guard. */
export function useSignedInAccount(): Account {
  const { session } = useSession();
  if (session.status !== "signedIn") {
    throw new Error("useSignedInAccount was called while signed out; use it only in signed-in screens.");
  }
  return session.account;
}

/** For screens behind the sign-in guard, which only render while an account is signed in. */
export function useCalClient(): CalClient {
  const { calClient } = useSession();
  if (!calClient)
    throw new Error("useCalClient was called while signed out; use it only in signed-in screens.");
  return calClient;
}
