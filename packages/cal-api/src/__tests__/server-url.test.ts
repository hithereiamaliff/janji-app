import { describe, expect, it } from "bun:test";

import {
  apiRootUrlFromApiV2Address,
  defaultApiRootUrl,
  normalizeServerUrl,
  type UrlParseFailure,
} from "../server-url";

const rejectedInputs: Array<[string, UrlParseFailure]> = [
  ["", "empty"],
  ["   ", "empty"],
  ["http://book.techmavie.digital", "insecure"],
  ["ftp://book.techmavie.digital", "invalid"],
  ["https://user:secret@book.techmavie.digital", "invalid"],
  ["book tech mavie", "invalid"],
];

describe("normalizeServerUrl", () => {
  it.each([
    ["book.techmavie.digital", "https://book.techmavie.digital"],
    ["  Book.TechMavie.Digital/  ", "https://book.techmavie.digital"],
    [
      "https://book.techmavie.digital/techmavie/call-with-alan?month=2026-11",
      "https://book.techmavie.digital",
    ],
    ["https://cal.example.com:8443", "https://cal.example.com:8443"],
    ["http://localhost:3000", "http://localhost:3000"],
    ["http://10.0.2.2:3000", "http://10.0.2.2:3000"],
  ])("%p → %p", (input, expected) => {
    expect(normalizeServerUrl(input)).toEqual({ ok: true, url: expected });
  });

  it.each(rejectedInputs)("rejects %p as %p", (input, reason) => {
    expect(normalizeServerUrl(input)).toEqual({ ok: false, reason });
  });
});

describe("API root URLs", () => {
  it("uses /api on the server's origin by default", () => {
    expect(defaultApiRootUrl("https://book.techmavie.digital")).toBe("https://book.techmavie.digital/api");
  });

  it.each([
    ["https://book.techmavie.digital/api/v2", "https://book.techmavie.digital/api"],
    ["https://api.example.com/v2/", "https://api.example.com"],
    ["api.example.com", "https://api.example.com"],
  ])("accepts a separate API v2 address %p → %p", (input, expected) => {
    expect(apiRootUrlFromApiV2Address(input)).toEqual({ ok: true, url: expected });
  });
});
