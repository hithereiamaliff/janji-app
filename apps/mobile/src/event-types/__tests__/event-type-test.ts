import { bookingLink, toEventTypeSummary } from "@/event-types/event-type";
import { apiEventType } from "@/test-utils/fixtures";

describe("toEventTypeSummary", () => {
  it("keeps what the Event types tab shows", () => {
    expect(
      toEventTypeSummary(
        apiEventType({
          id: 4,
          title: "Consultation",
          slug: "consultation",
          lengthInMinutes: 180,
          hidden: true,
        })
      )
    ).toEqual({
      id: 4,
      title: "Consultation",
      slug: "consultation",
      lengthInMinutes: 180,
      lengthOptions: [],
      description: null,
      hidden: true,
    });
  });

  it("lists every length on offer, the default included, shortest first", () => {
    const eventType = apiEventType({
      id: 1,
      title: "Call",
      slug: "call",
      lengthInMinutes: 30,
      lengthInMinutesOptions: [60, 15],
    });

    expect(toEventTypeSummary(eventType).lengthOptions).toEqual([15, 30, 60]);
  });

  it("treats a blank description as none", () => {
    expect(
      toEventTypeSummary(apiEventType({ id: 1, title: "Call", slug: "call", description: "  " })).description
    ).toBeNull();
  });
});

describe("bookingLink", () => {
  it("points at the server the person signed in to, not API v2's own idea of the address", () => {
    expect(bookingLink("https://book.techmavie.digital", "techmavie", "consultation-penang")).toBe(
      "https://book.techmavie.digital/techmavie/consultation-penang"
    );
  });

  it("escapes characters that don't belong in a path", () => {
    expect(bookingLink("https://book.example.com/", "alan lee", "call?now")).toBe(
      "https://book.example.com/alan%20lee/call%3Fnow"
    );
  });
});
