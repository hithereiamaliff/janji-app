// expo-secure-store only accepts alphanumeric keys plus ".", "-" and "_". Checking on every platform makes
// the web shim reject the same keys the native store would.
const VALID_KEY = /^[\w.-]+$/;

export function assertValidSecureStorageKey(key: string): void {
  if (!VALID_KEY.test(key)) {
    throw new Error(
      `Invalid secure storage key "${key}": use only letters, numbers, ".", "-" and "_" (expo-secure-store rule).`
    );
  }
}
