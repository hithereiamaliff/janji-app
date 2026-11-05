import type { components } from "@janji/cal-api/schema";

export type ApiProfile = components["schemas"]["MeOutput"];

/** The signed-in person's Cal.diy profile, as far as the app shows or follows it. */
export type Profile = {
  name: string | null;
  email: string;
  username: string;
  timeZone: string;
  /** The clock Cal.diy shows them times on. */
  timeFormat: 12 | 24;
  /** The day their calendars start on: 0 for Sunday to 6 for Saturday. */
  weekStart: number;
};

/** Cal.diy's names for the days a week can start on, in the order of Profile's weekStart. */
export const WEEK_START_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// Cal.diy sends the week start as any string, so it's looked up among plain strings.
const dayNames: readonly string[] = WEEK_START_DAYS;

export function toProfile(me: ApiProfile): Profile {
  const weekStart = dayNames.indexOf(me.weekStart);
  return {
    name: me.name,
    email: me.email,
    username: me.username,
    timeZone: me.timeZone,
    timeFormat: me.timeFormat === 24 ? 24 : 12,
    // Cal.diy starts weeks on Sunday unless the person picks another day.
    weekStart: weekStart === -1 ? 0 : weekStart,
  };
}
