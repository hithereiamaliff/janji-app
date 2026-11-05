import { WEEK_DAYS, type WeekDay, type WeeklyHours } from "./schedule";

/** Part of a day, from start to end, as "HH:mm" on the schedule's clock. */
export type TimeRange = { start: string; end: string };

/** The ranges each day of the week is open for, which is how the hours are edited. */
export type DayRanges = Record<WeekDay, TimeRange[]>;

const pad = (value: number) => String(value).padStart(2, "0");

/** The times on offer, as on the web: every 15 minutes from midnight, then 23:59 to end the day. */
export const TIME_CHOICES: readonly string[] = [
  ...Array.from({ length: 96 }, (_, index) => `${pad(Math.floor(index / 4))}:${pad((index % 4) * 15)}`),
  "23:59",
];

/** Where a day that's switched on starts, as on the web. */
export const DEFAULT_RANGE: TimeRange = { start: "09:00", end: "17:00" };

function byStart(a: TimeRange, b: TimeRange): number {
  return a.start.localeCompare(b.start) || a.end.localeCompare(b.end);
}

export function emptyWeek(): DayRanges {
  return { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };
}

/** Spreads Cal.diy's hours, which group the days that share a range, out over each day. */
export function toDayRanges(hours: readonly WeeklyHours[]): DayRanges {
  const week = emptyWeek();
  for (const { days, startTime, endTime } of hours) {
    for (const day of days) week[day].push({ start: startTime, end: endTime });
  }
  for (const day of WEEK_DAYS) week[day].sort(byStart);
  return week;
}

/** Gathers the days back into Cal.diy's groups: one for each range, listing every day that has it. */
export function fromDayRanges(week: DayRanges): WeeklyHours[] {
  const groups = new Map<string, WeeklyHours>();
  for (const day of WEEK_DAYS) {
    for (const range of [...week[day]].sort(byStart)) {
      const key = `${range.start}-${range.end}`;
      const group = groups.get(key);
      if (group) group.days.push(day);
      else groups.set(key, { days: [day], startTime: range.start, endTime: range.end });
    }
  }
  return [...groups.values()];
}

/** Adds the minutes to "HH:mm", stopping at 23:59. */
function later(time: string, minutes: number): string {
  const [hours = 0, mins = 0] = time.split(":").map(Number);
  const total = Math.min(hours * 60 + mins + minutes, 23 * 60 + 59);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/**
 * A range to add after a day's last one: an hour from where it ends, as on the web. Null once the day is
 * open until its last quarter hour, which leaves no room for another.
 */
export function nextRange(ranges: readonly TimeRange[]): TimeRange | null {
  const last = [...ranges].sort(byStart).at(-1);
  if (!last) return DEFAULT_RANGE;
  if (last.end >= "23:45") return null;
  return { start: last.end, end: later(last.end, 60) };
}

export type DayProblem = "endsBeforeStart" | "overlaps";

/** What's wrong with each day's ranges, if anything: a range must end after it starts, and none may overlap. */
export function checkDayRanges(week: DayRanges): Partial<Record<WeekDay, DayProblem>> {
  const problems: Partial<Record<WeekDay, DayProblem>> = {};
  for (const day of WEEK_DAYS) {
    const ranges = [...week[day]].sort(byStart);
    if (ranges.some((range) => range.end <= range.start)) {
      problems[day] = "endsBeforeStart";
      continue;
    }
    for (let index = 1; index < ranges.length; index++) {
      const previous = ranges[index - 1];
      const range = ranges[index];
      if (previous && range && range.start < previous.end) problems[day] = "overlaps";
    }
  }
  return problems;
}
