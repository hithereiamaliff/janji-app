import type { components } from "@janji/cal-api/schema";

export type ApiProfile = components["schemas"]["MeOutput"];

/** The signed-in person's Cal.diy settings that the app follows. */
export type Profile = {
  timeZone: string;
  /** The clock Cal.diy shows them times on. */
  timeFormat: 12 | 24;
  /** The day their calendars start on: 0 for Sunday to 6 for Saturday. */
  weekStart: number;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function toProfile(me: ApiProfile): Profile {
  const weekStart = WEEKDAYS.indexOf(me.weekStart);
  return {
    timeZone: me.timeZone,
    timeFormat: me.timeFormat === 24 ? 24 : 12,
    // Cal.diy starts weeks on Sunday unless the person picks another day.
    weekStart: weekStart === -1 ? 0 : weekStart,
  };
}
