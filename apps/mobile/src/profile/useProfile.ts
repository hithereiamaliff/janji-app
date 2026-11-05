import { useQuery } from "@tanstack/react-query";

import { useAccountKey } from "@/data/useAccountKey";
import { useCalClient } from "@/session/SessionProvider";

import { fetchProfile } from "./profile-api";

/** The signed-in person's Cal.diy settings, such as the day their weeks start on. */
export function useProfile() {
  const client = useCalClient();
  return useQuery({ queryKey: ["profile", useAccountKey()], queryFn: () => fetchProfile(client) });
}
