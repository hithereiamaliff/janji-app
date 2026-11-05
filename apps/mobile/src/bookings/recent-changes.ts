// Cal.diy notifies the phone about changes made in Janji too, which would only tell the person what they just
// did. Its webhooks go out while it handles the change, so two minutes covers them with room to spare.
const QUIET_MS = 2 * 60_000;

const changedAt = new Map<string, number>();

/** Notes that the person is changing this booking in Janji now. */
export function noteChangedHere(uid: string, now: number = Date.now()): void {
  changedAt.set(uid, now);
}

/** Whether the person changed this booking in Janji in the last two minutes. */
export function changedHereRecently(uid: string, now: number = Date.now()): boolean {
  const at = changedAt.get(uid);
  if (at === undefined) return false;
  if (now - at <= QUIET_MS) return true;
  changedAt.delete(uid);
  return false;
}
