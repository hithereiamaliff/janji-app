import { type CalClient, unwrap } from "@janji/cal-api/client";

import { type Profile, toProfile } from "./profile";

export async function fetchProfile(client: CalClient): Promise<Profile> {
  return toProfile(unwrap(await client.GET("/v2/me")).data);
}
