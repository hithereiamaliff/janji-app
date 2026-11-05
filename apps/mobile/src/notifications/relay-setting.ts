import { deleteSecureItem, getSecureItem, setSecureItem } from "@/lib/secure-storage";

const RELAY_KEY = "janji.relayOrigin";

/**
 * A relay's origin from an address: "https://relay.example/x" gives "https://relay.example", and a bare
 * "relay.example" counts as HTTPS. Anything else gives null, plain HTTP too, since webhook secrets and device
 * tokens travel to the relay.
 */
export function relayOriginFrom(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const address = value.trim();
  if (!address) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(address) ? address : `https://${address}`);
    return url.protocol === "https:" && url.hostname.includes(".") ? url.origin : null;
  } catch {
    return null;
  }
}

/** The relay the person chose under Advanced in place of the build's, or null. */
export async function loadRelayChoice(): Promise<string | null> {
  return relayOriginFrom(await getSecureItem(RELAY_KEY));
}

/** Keeps the relay chosen under Advanced; null goes back to the build's. */
export async function saveRelayChoice(origin: string | null): Promise<void> {
  if (origin === null) await deleteSecureItem(RELAY_KEY);
  else await setSecureItem(RELAY_KEY, origin);
}
