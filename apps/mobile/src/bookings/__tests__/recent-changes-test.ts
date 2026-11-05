import { changedHereRecently, noteChangedHere } from "@/bookings/recent-changes";

describe("recent changes", () => {
  const now = Date.parse("2026-11-05T09:00:00Z");

  it("remembers a booking changed in Janji for two minutes", () => {
    noteChangedHere("booking-1", now);

    expect(changedHereRecently("booking-1", now + 119_000)).toBe(true);
    expect(changedHereRecently("booking-1", now + 121_000)).toBe(false);
    expect(changedHereRecently("booking-1", now)).toBe(false);
  });

  it("knows nothing of bookings that weren't changed here", () => {
    expect(changedHereRecently("booking-2", now)).toBe(false);
  });
});
