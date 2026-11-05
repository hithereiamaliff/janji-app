import { useSession } from "@/session/SessionProvider";

import { useNotificationsSync } from "./useNotifications";

function SignedInSync() {
  useNotificationsSync();
  return null;
}

/** Keeps this phone's notifications working while someone is signed in. It shows nothing. */
export function NotificationsSync() {
  const { session } = useSession();
  return session.status === "signedIn" ? <SignedInSync /> : null;
}
