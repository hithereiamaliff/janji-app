import * as SecureStore from "expo-secure-store";

import { assertValidSecureStorageKey } from "./secure-storage-key";

export async function getSecureItem(key: string): Promise<string | null> {
  assertValidSecureStorageKey(key);
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  assertValidSecureStorageKey(key);
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  assertValidSecureStorageKey(key);
  await SecureStore.deleteItemAsync(key);
}
