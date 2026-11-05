import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAccountKey } from "@/data/useAccountKey";
import { useCalClient } from "@/session/SessionProvider";

import { type Schedule, sortSchedules } from "./schedule";
import {
  createSchedule,
  deleteSchedule,
  fetchSchedules,
  type NewSchedule,
  setDefaultSchedule,
} from "./schedules-api";

function useSchedulesKey() {
  return ["schedules", useAccountKey()] as const;
}

/** The signed-in person's schedules, the default first. */
export function useSchedules() {
  const client = useCalClient();
  const queryKey = useSchedulesKey();
  return useQuery({ queryKey, queryFn: () => fetchSchedules(client) });
}

/** One schedule, read from the list, which holds everything the app shows about it. */
export function useSchedule(id: number) {
  const client = useCalClient();
  const queryKey = useSchedulesKey();
  return useQuery({
    queryKey,
    queryFn: () => fetchSchedules(client),
    select: (schedules) => schedules.find((schedule) => schedule.id === id) ?? null,
  });
}

/** Puts a schedule the server returned into the list, as the only default if it's now the default. */
function withSchedule(schedules: Schedule[] | undefined, saved: Schedule): Schedule[] | undefined {
  if (!schedules) return schedules;
  const others = schedules
    .filter((schedule) => schedule.id !== saved.id)
    .map((schedule) => (saved.isDefault ? { ...schedule, isDefault: false } : schedule));
  return sortSchedules([...others, saved]);
}

export function useCreateSchedule() {
  const client = useCalClient();
  const queryKey = useSchedulesKey();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (schedule: NewSchedule) => createSchedule(client, schedule),
    retry: false,
    onSuccess: (created) => {
      queryClient.setQueryData<Schedule[]>(queryKey, (schedules) => withSchedule(schedules, created));
    },
  });
}

export function useSetDefaultSchedule() {
  const client = useCalClient();
  const queryKey = useSchedulesKey();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => setDefaultSchedule(client, id),
    retry: false,
    onSuccess: (saved) => {
      queryClient.setQueryData<Schedule[]>(queryKey, (schedules) => withSchedule(schedules, saved));
    },
  });
}

export function useDeleteSchedule() {
  const client = useCalClient();
  const queryKey = useSchedulesKey();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteSchedule(client, id),
    retry: false,
    onSuccess: (_, id) => {
      queryClient.setQueryData<Schedule[]>(queryKey, (schedules) =>
        schedules?.filter((schedule) => schedule.id !== id)
      );
    },
    // Cal.diy answers 400, not 404, for a schedule that's already gone, so the list is fetched again to
    // drop one deleted elsewhere instead of offering it forever.
    onError: () => queryClient.invalidateQueries({ queryKey }),
  });
}
