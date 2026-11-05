import { bookingLink, readableLink, toEventTypeSummary } from "@/event-types/event-type";
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
      minimumBookingNotice: 0,
      hidden: true,
      scheduleId: null,
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

  it("keeps the minimum notice in minutes", () => {
    expect(
      toEventTypeSummary(apiEventType({ id: 1, title: "Call", slug: "call", minimumBookingNotice: 1440 }))
        .minimumBookingNotice
    ).toBe(1440);
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

describe("readableLink", () => {
  it("drops the scheme", () => {
    expect(readableLink("https://book.example.com/alan/consultation")).toBe(
      "book.example.com/alan/consultation"
    );
  });

  it("shows a slug in another script as it was typed", () => {
    expect(readableLink(bookingLink("https://book.example.com", "alan", "预约-咨询"))).toBe(
      "book.example.com/alan/预约-咨询"
    );
  });
});
