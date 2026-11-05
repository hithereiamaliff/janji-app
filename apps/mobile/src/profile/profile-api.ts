import { type CalClient, unwrap } from "@janji/cal-api/client";

import { type Profile, toProfile, WEEK_START_DAYS } from "./profile";

export async function fetchProfile(client: CalClient): Promise<Profile> {
  return toProfile(unwrap(await client.GET("/v2/me")).data);
}

/** The profile settings the app can change. Only what's given is sent. */
export type ProfileChanges = {
  name?: string;
  timeZone?: string;
  timeFormat?: 12 | 24;
  weekStart?: number;
};

/**
 * Saves changes to the profile. Cal.diy moves the default schedule to a new time zone along with the profile,
 * so the schedules need reloading after one.
 */
export async function updateProfile(client: CalClient, changes: ProfileChanges): Promise<Profile> {
  const { weekStart, ...rest } = changes;
  const body = unwrap(
    await client.PATCH("/v2/me", {
      body: { ...rest, ...(weekStart === undefined ? {} : { weekStart: WEEK_START_DAYS[weekStart] }) },
    })
  );
  return toProfile(body.data);
}
