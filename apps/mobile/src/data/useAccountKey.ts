import { useSession } from "@/session/SessionProvider";

/** Identifies the signed-in account in query keys, so two accounts' data never share a cache entry. */
export function useAccountKey(): string {
  const { session } = useSession();
  return session.status === "signedIn"
    ? `${session.account.serverOrigin}#${session.account.user.id}`
    : "signed-out";
}
