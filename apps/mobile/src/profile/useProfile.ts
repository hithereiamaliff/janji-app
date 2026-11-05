import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAccountKey } from "@/data/useAccountKey";
import type { AccountUser } from "@/session/account";
import { useCalClient, useSession, useSignedInAccount } from "@/session/SessionProvider";

import type { Profile } from "./profile";
import { fetchProfile, type ProfileChanges, updateProfile } from "./profile-api";

function useProfileKey() {
  return ["profile", useAccountKey()] as const;
}

/** The signed-in person's details as they are now, kept with the account so every screen sees them. */
function userFrom(profile: Profile, user: AccountUser): AccountUser {
  return {
    id: user.id,
    username: profile.username,
    name: profile.name,
    email: profile.email,
    timeZone: profile.timeZone,
  };
}

function sameUser(a: AccountUser, b: AccountUser): boolean {
  return (
    a.id === b.id &&
    a.username === b.username &&
    a.name === b.name &&
    a.email === b.email &&
    a.timeZone === b.timeZone
  );
}

/**
 * Keeps the account's copy of the person's details, made at sign-in, up to date with their profile. Booking
 * links, rescheduling and the profile time zone note all read that copy, so a change made on the web reaches
 * them too.
 */
function useSyncUser(profile: Profile | undefined) {
  const { user } = useSignedInAccount();
  const { updateUser } = useSession();
  useEffect(() => {
    if (!profile) return;
    const current = userFrom(profile, user);
    // Saving can fail if the Keychain or Keystore is unavailable; the old copy then stays until the next try.
    if (!sameUser(current, user)) updateUser(current).catch(() => undefined);
  }, [profile, user, updateUser]);
}

/** The signed-in person's Cal.diy profile, such as their name and the day their weeks start on. */
export function useProfile() {
  const client = useCalClient();
  const query = useQuery({ queryKey: useProfileKey(), queryFn: () => fetchProfile(client) });
  useSyncUser(query.data);
  return query;
}

/** Saves changes to the profile, then shows it as the server returned it. */
export function useUpdateProfile() {
  const client = useCalClient();
  const queryKey = useProfileKey();
  const accountKey = useAccountKey();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changes: ProfileChanges) => updateProfile(client, changes),
    retry: false,
    onSuccess: (saved, changes) => {
      queryClient.setQueryData(queryKey, saved);
      // Cal.diy moves the default schedule to the new time zone as well.
      if (changes.timeZone) void queryClient.invalidateQueries({ queryKey: ["schedules", accountKey] });
    },
  });
}
