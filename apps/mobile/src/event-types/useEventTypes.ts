import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAccountKey } from "@/data/useAccountKey";
import { useCalClient } from "@/session/SessionProvider";

import type { EventTypeSummary } from "./event-type";
import { type EventTypeChanges, fetchEventTypes, updateEventType } from "./event-types-api";

function useEventTypesKey() {
  return ["eventTypes", useAccountKey()] as const;
}

/** The signed-in person's event types, keyed by account like every query. */
export function useEventTypes() {
  const client = useCalClient();
  const queryKey = useEventTypesKey();
  return useQuery({ queryKey, queryFn: () => fetchEventTypes(client) });
}

/** One event type, read from the list, which holds everything the app shows about it. */
export function useEventType(id: number) {
  const client = useCalClient();
  const queryKey = useEventTypesKey();
  return useQuery({
    queryKey,
    queryFn: () => fetchEventTypes(client),
    select: (eventTypes) => eventTypes.find((eventType) => eventType.id === id) ?? null,
  });
}

type HiddenChange = { id: number; hidden: boolean };

function withHidden(eventTypes: EventTypeSummary[] | undefined, { id, hidden }: HiddenChange) {
  return eventTypes?.map((eventType) => (eventType.id === id ? { ...eventType, hidden } : eventType));
}

/**
 * Shows or hides an event type on the booking page. The switch moves straight away and moves back if the
 * server refuses; like other changes, it isn't retried.
 */
export function useSetEventTypeHidden() {
  const client = useCalClient();
  const queryKey = useEventTypesKey();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, hidden }: HiddenChange) => updateEventType(client, id, { hidden }),
    retry: false,
    onMutate: async (change) => {
      // A list request still on its way could otherwise land after this and undo the change on screen.
      await queryClient.cancelQueries({ queryKey });
      const before = queryClient.getQueryData<EventTypeSummary[]>(queryKey);
      queryClient.setQueryData<EventTypeSummary[]>(queryKey, (eventTypes) => withHidden(eventTypes, change));
      return { before };
    },
    onError: (_error, _change, context) => {
      queryClient.setQueryData(queryKey, context?.before);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<EventTypeSummary[]>(queryKey, (eventTypes) =>
        eventTypes?.map((eventType) => (eventType.id === updated.id ? updated : eventType))
      );
    },
  });
}

/** Saves changes to an event type's settings, then shows it as the server returned it. */
export function useUpdateEventType(id: number) {
  const client = useCalClient();
  const queryKey = useEventTypesKey();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changes: EventTypeChanges) => updateEventType(client, id, changes),
    retry: false,
    onSuccess: (updated) => {
      queryClient.setQueryData<EventTypeSummary[]>(queryKey, (eventTypes) =>
        eventTypes?.map((eventType) => (eventType.id === updated.id ? updated : eventType))
      );
    },
  });
}
