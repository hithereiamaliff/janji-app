import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAccountKey } from "@/data/useAccountKey";
import { useCalClient, useSignedInAccount } from "@/session/SessionProvider";

import type { BookingDetail } from "./booking-detail";
import { noteChangedHere } from "./recent-changes";
import { fetchRescheduleSlots, rescheduleBooking } from "./reschedule";

export type SlotWindow = {
  from: Date;
  to: Date;
};

/** Free start times between `from` and `to` that the booking could move to. */
export function useRescheduleSlots(booking: BookingDetail, { from, to }: SlotWindow) {
  const client = useCalClient();
  const accountKey = useAccountKey();

  return useQuery({
    queryKey: ["rescheduleSlots", accountKey, booking.uid, from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetchRescheduleSlots(client, {
        eventTypeId: booking.eventTypeId,
        uid: booking.uid,
        durationMinutes: booking.durationMinutes,
        from,
        to,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    // Other people book in the meantime, so free times are fetched afresh rather than shown from a cache.
    staleTime: 0,
  });
}

export type RescheduleInput = {
  start: string;
  reason?: string;
};

/**
 * Moves a booking to a new time, as the host, and resolves with the uid of the booking Cal.diy creates for
 * it. Like other actions it isn't retried, since a repeat could email the attendees twice.
 */
export function useRescheduleBooking(uid: string) {
  const client = useCalClient();
  const accountKey = useAccountKey();
  const account = useSignedInAccount();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ start, reason }: RescheduleInput) =>
      rescheduleBooking(client, uid, { start, reason, rescheduledBy: account.user.email }),
    retry: false,
    // Before the request, since Cal.diy's notification about it can reach the phone before the answer does.
    onMutate: () => noteChangedHere(uid),
    onSuccess: (newUid) => {
      noteChangedHere(newUid);
      // Cal.diy cancels the original booking as rescheduled and creates a new one, so cached bookings and lists
      // reload, and this booking's free times no longer apply.
      void queryClient.invalidateQueries({ queryKey: ["booking", accountKey] });
      void queryClient.invalidateQueries({ queryKey: ["bookings", accountKey] });
      queryClient.removeQueries({ queryKey: ["rescheduleSlots", accountKey, uid] });
    },
  });
}
