import {
  type PrivateLink,
  privateLinkUrl,
  sortPrivateLinks,
  toPrivateLink,
} from "@/event-types/private-links";
import { apiPrivateLink } from "@/test-utils/fixtures";

describe("toPrivateLink", () => {
  it("keeps the date a link ends on", () => {
    expect(toPrivateLink(apiPrivateLink({ id: "k3Ej9", expiresAt: "2026-12-31T15:59:59.999Z" }))).toEqual({
      id: "k3Ej9",
      limit: { kind: "date", expiresAt: "2026-12-31T15:59:59.999Z" },
      expired: false,
    });
  });

  it("keeps how many bookings a link allows and how many it's had", () => {
    expect(toPrivateLink(apiPrivateLink({ id: "p8Rw2", used: 5, max: 5, expired: true }))).toEqual({
      id: "p8Rw2",
      limit: { kind: "bookings", used: 5, max: 5 },
      expired: true,
    });
  });
});

describe("privateLinkUrl", () => {
  it("points at the private booking page on the person's own server, with the event type's slug", () => {
    expect(privateLinkUrl("https://book.techmavie.digital/", "k3Ej9", "consultation-penang")).toBe(
      "https://book.techmavie.digital/d/k3Ej9/consultation-penang"
    );
  });

  it("escapes characters that don't belong in a path", () => {
    expect(privateLinkUrl("https://book.example.com", "a/b", "call?now")).toBe(
      "https://book.example.com/d/a%2Fb/call%3Fnow"
    );
  });
});

describe("sortPrivateLinks", () => {
  const byDate = (id: string, expiresAt: string, expired = false): PrivateLink => ({
    id,
    limit: { kind: "date", expiresAt },
    expired,
  });
  const byBookings = (id: string, used: number, max: number): PrivateLink => ({
    id,
    limit: { kind: "bookings", used, max },
    expired: used >= max,
  });

  it("lists links that still work first, those ending soonest at the top, and expired ones last", () => {
    const links = [
      byBookings("used-up", 1, 1),
      byBookings("single-use", 0, 1),
      byDate("next-month", "2026-12-05T15:59:59.999Z"),
      byDate("ended", "2026-11-01T15:59:59.999Z", true),
      byDate("tomorrow", "2026-11-06T15:59:59.999Z"),
      byBookings("five-bookings", 2, 5),
    ];

    expect(sortPrivateLinks(links).map((link) => link.id)).toEqual([
      "tomorrow",
      "next-month",
      "single-use",
      "five-bookings",
      "used-up",
      "ended",
    ]);
  });

  it("doesn't change the list it's given", () => {
    const links = [byBookings("single-use", 0, 1), byDate("tomorrow", "2026-11-06T15:59:59.999Z")];

    sortPrivateLinks(links);

    expect(links.map((link) => link.id)).toEqual(["single-use", "tomorrow"]);
  });
});
