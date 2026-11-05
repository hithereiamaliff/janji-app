const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** A random string with `byteLength` bytes of randomness, safe in URLs. */
export function randomToken(byteLength = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/**
 * Device tokens are kept as this hash. Comparing hashes needs no constant-time check: how much of a hash
 * matched says nothing about the token that would match it all.
 */
export async function sha256(text: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text))));
}

/** SECRETS_KEY is 32 random bytes in base64, such as `openssl rand -base64 32` prints. */
function importKey(keyBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromBase64(keyBase64), "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Seals a secret for storage with AES-GCM, as "v1.<iv>.<ciphertext>". */
export async function encryptSecret(secret: string, keyBase64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await importKey(keyBase64),
    encoder.encode(secret)
  );
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(sealed))}`;
}

/** Opens a secret sealed by encryptSecret. It throws if the key is wrong or the stored value was changed. */
export async function decryptSecret(stored: string, keyBase64: string): Promise<string> {
  const [version, iv, sealed] = stored.split(".");
  if (version !== "v1" || !iv || !sealed) throw new Error("Not a sealed secret this relay can open");
  const opened = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    await importKey(keyBase64),
    fromBase64(sealed)
  );
  return new TextDecoder().decode(opened);
}
