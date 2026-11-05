import type { BookingSummary } from "@/bookings/booking";
import { groupByDay } from "@/bookings/group-by-day";

function booking(uid: string, start: string): BookingSummary {
  return {
    uid,
    title: `Booking ${uid}`,
    start,
    end: start,
    status: "accepted",
    attendees: [],
    location: null,
    meetingUrl: null,
    isRecurring: false,
  };
}

describe("groupByDay", () => {
  it("makes one section per day, in the bookings' order", () => {
    const sections = groupByDay(
      [
        booking("a", "2026-11-06T07:00:00Z"),
        booking("b", "2026-11-06T09:00:00Z"),
        booking("c", "2026-11-08T07:00:00Z"),
      ],
      (startIso) => `day of ${startIso.slice(0, 10)}`
    );

    expect(sections).toEqual([
      {
        key: "2026-11-06",
        title: "day of 2026-11-06",
        data: [expect.objectContaining({ uid: "a" }), expect.objectContaining({ uid: "b" })],
      },
      { key: "2026-11-08", title: "day of 2026-11-08", data: [expect.objectContaining({ uid: "c" })] },
    ]);
  });

  it("works the same for newest-first lists", () => {
    const sections = groupByDay(
      [
        booking("c", "2026-11-08T07:00:00Z"),
        booking("b", "2026-11-06T09:00:00Z"),
        booking("a", "2026-11-06T07:00:00Z"),
      ],
      () => "title"
    );

    expect(sections.map((section) => [section.key, section.data.map((item) => item.uid)])).toEqual([
      ["2026-11-08", ["c"]],
      ["2026-11-06", ["b", "a"]],
    ]);
  });

  it("returns no sections for no bookings", () => {
    expect(groupByDay([], () => "title")).toEqual([]);
  });
});
