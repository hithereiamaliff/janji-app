import { type Schedule, sortSchedules, toSchedule } from "@/availability/schedule";
import { apiSchedule } from "@/test-utils/fixtures";

describe("toSchedule", () => {
  it("keeps a schedule's hours, with the days in week order", () => {
    expect(
      toSchedule(
        apiSchedule({
          id: 1,
          name: "Consultation hours",
          isDefault: true,
          availability: [
            {
              days: ["Sunday", "Monday", "Tuesday", "Friday", "Saturday"],
              startTime: "10:00",
              endTime: "18:00",
            },
          ],
          overrides: [{ date: "2026-12-25", startTime: "00:00", endTime: "00:00" }],
        })
      )
    ).toEqual({
      id: 1,
      name: "Consultation hours",
      timeZone: "Asia/Kuala_Lumpur",
      isDefault: true,
      hours: [
        { days: ["Monday", "Tuesday", "Friday", "Saturday", "Sunday"], startTime: "10:00", endTime: "18:00" },
      ],
      overrides: [{ date: "2026-12-25", startTime: "00:00", endTime: "00:00" }],
    });
  });
});

describe("sortSchedules", () => {
  const schedule = (id: number, isDefault = false): Schedule => ({
    id,
    name: `Schedule ${id}`,
    timeZone: "Asia/Kuala_Lumpur",
    isDefault,
    hours: [],
    overrides: [],
  });

  it("puts the default first, then the others oldest first", () => {
    expect(sortSchedules([schedule(9), schedule(4, true), schedule(2)]).map(({ id }) => id)).toEqual([
      4, 2, 9,
    ]);
  });
});
