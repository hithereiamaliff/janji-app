import { deleteSecureItem, getSecureItem, setSecureItem } from "@/lib/secure-storage";

import { type Account, isAccount } from "./account";

const ACCOUNT_KEY = "janji.account";
const API_KEY_KEY = "janji.apiKey";

export type SavedSession = {
  account: Account;
  apiKey: string;
};

function parseAccount(json: string): Account | null {
  try {
    const value: unknown = JSON.parse(json);
    return isAccount(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Returns the saved session, or null. A half-written or unreadable session (an interrupted save, data from
 * an incompatible app version) can't be used, so it is deleted and the person signs in again.
 */
export async function loadSavedSession(): Promise<SavedSession | null> {
  const [accountJson, apiKey] = await Promise.all([getSecureItem(ACCOUNT_KEY), getSecureItem(API_KEY_KEY)]);
  if (accountJson === null && apiKey === null) return null;

  const account = accountJson === null ? null : parseAccount(accountJson);
  if (account === null || apiKey === null) {
    await clearSavedSession();
    return null;
  }
  return { account, apiKey };
}

export async function saveSession({ account, apiKey }: SavedSession): Promise<void> {
  await setSecureItem(API_KEY_KEY, apiKey);
  await setSecureItem(ACCOUNT_KEY, JSON.stringify(account));
}

export async function clearSavedSession(): Promise<void> {
  await Promise.all([deleteSecureItem(ACCOUNT_KEY), deleteSecureItem(API_KEY_KEY)]);
}
