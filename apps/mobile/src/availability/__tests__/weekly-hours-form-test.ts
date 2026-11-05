import type { WeeklyHours } from "@/availability/schedule";
import {
  checkDayRanges,
  DEFAULT_RANGE,
  emptyWeek,
  fromDayRanges,
  nextRange,
  TIME_CHOICES,
  toDayRanges,
} from "@/availability/weekly-hours-form";

const splitWeek: WeeklyHours[] = [
  { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], startTime: "09:00", endTime: "12:00" },
  { days: ["Monday", "Tuesday", "Wednesday", "Thursday"], startTime: "13:00", endTime: "17:00" },
  { days: ["Saturday"], startTime: "10:00", endTime: "13:00" },
];

describe("TIME_CHOICES", () => {
  it("offers every 15 minutes from midnight, then 23:59 to end the day", () => {
    expect(TIME_CHOICES.slice(0, 3)).toEqual(["00:00", "00:15", "00:30"]);
    expect(TIME_CHOICES.slice(-3)).toEqual(["23:30", "23:45", "23:59"]);
    expect(TIME_CHOICES).toHaveLength(97);
  });
});

describe("toDayRanges", () => {
  it("spreads the hours out over each day, earliest first", () => {
    const week = toDayRanges([...splitWeek].reverse());

    expect(week.Monday).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ]);
    expect(week.Friday).toEqual([{ start: "09:00", end: "12:00" }]);
    expect(week.Saturday).toEqual([{ start: "10:00", end: "13:00" }]);
    expect(week.Sunday).toEqual([]);
  });
});

describe("fromDayRanges", () => {
  it("gathers the days that share a range, as Cal.diy keeps them", () => {
    expect(fromDayRanges(toDayRanges(splitWeek))).toEqual(splitWeek);
  });

  it("gives no hours for a week with every day off", () => {
    expect(fromDayRanges(emptyWeek())).toEqual([]);
  });
});

describe("nextRange", () => {
  it("starts a day that's switched on at 9:00 to 17:00", () => {
    expect(nextRange([])).toEqual(DEFAULT_RANGE);
  });

  it("adds an hour from where the day's last range ends", () => {
    expect(
      nextRange([
        { start: "13:00", end: "17:00" },
        { start: "09:00", end: "12:00" },
      ])
    ).toEqual({ start: "17:00", end: "18:00" });
  });

  it("stops at the end of the day", () => {
    expect(nextRange([{ start: "20:00", end: "23:30" }])).toEqual({ start: "23:30", end: "23:59" });
  });

  it("adds nothing once the day is open into its last quarter hour", () => {
    expect(nextRange([{ start: "20:00", end: "23:59" }])).toBeNull();
  });
});

describe("checkDayRanges", () => {
  it("finds nothing wrong with hours like Cal.diy's own", () => {
    expect(checkDayRanges(toDayRanges(splitWeek))).toEqual({});
  });

  it("finds a range that ends before it starts, or as it starts", () => {
    const week = emptyWeek();
    week.Monday = [{ start: "17:00", end: "09:00" }];
    week.Tuesday = [{ start: "09:00", end: "09:00" }];

    expect(checkDayRanges(week)).toEqual({ Monday: "endsBeforeStart", Tuesday: "endsBeforeStart" });
  });

  it("finds ranges that overlap, but not ones that only meet", () => {
    const week = emptyWeek();
    week.Wednesday = [
      { start: "13:00", end: "17:00" },
      { start: "09:00", end: "13:30" },
    ];
    week.Thursday = [
      { start: "09:00", end: "12:00" },
      { start: "12:00", end: "17:00" },
    ];

    expect(checkDayRanges(week)).toEqual({ Wednesday: "overlaps" });
  });
});
