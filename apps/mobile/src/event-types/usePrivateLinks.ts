import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAccountKey } from "@/data/useAccountKey";
import { useCalClient } from "@/session/SessionProvider";

import { type PrivateLink, sortPrivateLinks } from "./private-links";
import {
  createPrivateLink,
  deletePrivateLink,
  fetchPrivateLinks,
  type NewPrivateLinkLimit,
} from "./private-links-api";

function usePrivateLinksKey(eventTypeId: number) {
  return ["privateLinks", useAccountKey(), eventTypeId] as const;
}

/** An event type's private links, those that still work first. */
export function usePrivateLinks(eventTypeId: number) {
  const client = useCalClient();
  const queryKey = usePrivateLinksKey(eventTypeId);
  return useQuery({ queryKey, queryFn: () => fetchPrivateLinks(client, eventTypeId) });
}

/** Makes a new private link and adds it to the event type's list. Like other changes, it isn't retried. */
export function useCreatePrivateLink(eventTypeId: number) {
  const client = useCalClient();
  const queryKey = usePrivateLinksKey(eventTypeId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (limit: NewPrivateLinkLimit) => createPrivateLink(client, eventTypeId, limit),
    retry: false,
    onSuccess: (created) => {
      queryClient.setQueryData<PrivateLink[]>(
        queryKey,
        (links) => links && sortPrivateLinks([created, ...links])
      );
    },
  });
}

/** Deletes a private link and takes it off the event type's list. */
export function useDeletePrivateLink(eventTypeId: number) {
  const client = useCalClient();
  const queryKey = usePrivateLinksKey(eventTypeId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => deletePrivateLink(client, eventTypeId, linkId),
    retry: false,
    onSuccess: (_, linkId) => {
      queryClient.setQueryData<PrivateLink[]>(queryKey, (links) =>
        links?.filter((link) => link.id !== linkId)
      );
    },
  });
}
