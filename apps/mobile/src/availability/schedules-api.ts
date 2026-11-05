import { type CalClient, unwrap } from "@janji/cal-api/client";

import { type Schedule, sortSchedules, toSchedule, type WeeklyHours } from "./schedule";

/** The signed-in person's schedules, the default first. */
export async function fetchSchedules(client: CalClient): Promise<Schedule[]> {
  const body = unwrap(await client.GET("/v2/schedules"));
  return sortSchedules(body.data.map(toSchedule));
}

export type NewSchedule = {
  name: string;
  timeZone: string;
  /** Makes it the schedule event types use unless they name another. */
  isDefault: boolean;
};

/** Makes a schedule. Cal.diy gives it Monday to Friday, 9:00 to 17:00, which can then be changed. */
export async function createSchedule(client: CalClient, schedule: NewSchedule): Promise<Schedule> {
  const body = unwrap(await client.POST("/v2/schedules", { body: schedule }));
  return toSchedule(body.data);
}

/** Makes a schedule the default. Only one can be, so the one that was stops being it. */
export async function setDefaultSchedule(client: CalClient, id: number): Promise<Schedule> {
  // The spec types this route's ID as text, unlike the others, though Cal.diy reads it as a number.
  const body = unwrap(
    await client.PATCH("/v2/schedules/{scheduleId}", {
      params: { path: { scheduleId: String(id) } },
      body: { isDefault: true },
    })
  );
  return toSchedule(body.data);
}

/** The settings the app can change. Only what's given is sent; weekly hours given replace all of them. */
export type ScheduleChanges = {
  name?: string;
  timeZone?: string;
  hours?: WeeklyHours[];
};

export async function updateSchedule(
  client: CalClient,
  id: number,
  changes: ScheduleChanges
): Promise<Schedule> {
  const { hours, ...rest } = changes;
  const body = unwrap(
    await client.PATCH("/v2/schedules/{scheduleId}", {
      params: { path: { scheduleId: String(id) } },
      body: { ...rest, ...(hours ? { availability: hours } : {}) },
    })
  );
  return toSchedule(body.data);
}

/**
 * Deletes a schedule; event types that used it fall back to the default. API v2 deletes the default schedule
 * too, which leaves the person with none until another is made the default, so the app never offers that.
 */
export async function deleteSchedule(client: CalClient, id: number): Promise<void> {
  unwrap(await client.DELETE("/v2/schedules/{scheduleId}", { params: { path: { scheduleId: id } } }));
}
