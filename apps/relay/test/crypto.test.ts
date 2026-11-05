import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, randomToken, sha256 } from "../src/crypto";

const key = btoa("janji-relay-test-key-32-bytes-!!");
const otherKey = btoa("another-relay-key-of-32-bytes-!!");

describe("relay crypto", () => {
  it("makes random tokens that are safe in URLs", () => {
    const token = randomToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(token);
    expect(randomToken(16)).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("hashes the same text the same way", async () => {
    expect(await sha256("token")).toBe(await sha256("token"));
    expect(await sha256("token")).not.toBe(await sha256("tokens"));
  });

  it("seals a secret so only the same key opens it", async () => {
    const sealed = await encryptSecret("whsec_example", key);

    expect(sealed).toMatch(/^v1\.[\w-]+\.[\w-]+$/);
    expect(sealed).not.toContain("whsec_example");
    expect(await encryptSecret("whsec_example", key)).not.toBe(sealed);
    expect(await decryptSecret(sealed, key)).toBe("whsec_example");
    await expect(decryptSecret(sealed, otherKey)).rejects.toThrow();
    await expect(decryptSecret("whsec_example", key)).rejects.toThrow();
  });
});
