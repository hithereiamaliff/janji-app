import type { components } from "@janji/cal-api/schema";

export type ApiSchedule = components["schemas"]["ScheduleOutput_2024_06_11"];

export type WeekDay = ApiSchedule["availability"][number]["days"][number];

/** Monday first, the order schedules list their days in. */
export const WEEK_DAYS: readonly WeekDay[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** Hours on some days of every week. Times are "HH:mm" on the clock in the schedule's time zone. */
export type WeeklyHours = { days: WeekDay[]; startTime: string; endTime: string };

/** Hours that replace the weekly ones on one date ("YYYY-MM-DD"). */
export type DateOverride = { date: string; startTime: string; endTime: string };

export type Schedule = {
  id: number;
  name: string;
  timeZone: string;
  /** The schedule event types use unless they name another. */
  isDefault: boolean;
  hours: WeeklyHours[];
  overrides: DateOverride[];
};

function inWeekOrder(days: readonly WeekDay[]): WeekDay[] {
  return WEEK_DAYS.filter((day) => days.includes(day));
}

export function toSchedule(schedule: ApiSchedule): Schedule {
  return {
    id: schedule.id,
    name: schedule.name,
    timeZone: schedule.timeZone,
    isDefault: schedule.isDefault,
    hours: schedule.availability.map(({ days, startTime, endTime }) => ({
      days: inWeekOrder(days),
      startTime,
      endTime,
    })),
    overrides: schedule.overrides.map(({ date, startTime, endTime }) => ({ date, startTime, endTime })),
  };
}

/** The default first, then the rest oldest first. Cal.diy sends them in no set order. */
export function sortSchedules(schedules: readonly Schedule[]): Schedule[] {
  return [...schedules].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.id - b.id);
}
