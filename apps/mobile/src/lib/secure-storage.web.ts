import { assertValidSecureStorageKey } from "./secure-storage-key";

// expo-secure-store has no web implementation. Web builds are only for development and automated UI
// checks, so secrets stay in memory and vanish on reload instead of being written to localStorage.
const memory = new Map<string, string>();

export async function getSecureItem(key: string): Promise<string | null> {
  assertValidSecureStorageKey(key);
  return memory.get(key) ?? null;
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  assertValidSecureStorageKey(key);
  memory.set(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  assertValidSecureStorageKey(key);
  memory.delete(key);
}
