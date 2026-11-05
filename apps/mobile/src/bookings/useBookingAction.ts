import type { CalClient } from "@janji/cal-api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAccountKey } from "@/data/useAccountKey";
import { useCalClient } from "@/session/SessionProvider";

import type { BookingDetail } from "./booking-detail";

type BookingAction<Input> = (client: CalClient, uid: string, input: Input) => Promise<BookingDetail | null>;

/**
 * Runs an action such as confirm or cancel on one booking. Actions aren't retried, since repeating one
 * could, say, send attendees a second email. Afterwards the booking shows as the server returned it, and the
 * lists refresh in the background.
 */
export function useBookingAction<Input = void>(uid: string, action: BookingAction<Input>) {
  const client = useCalClient();
  const accountKey = useAccountKey();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Input) => action(client, uid, input),
    retry: false,
    onSuccess: (booking) => {
      // Cancelling or confirming a series changes its other occurrences too, so every cached booking goes
      // stale and reloads when next opened.
      void queryClient.invalidateQueries({ queryKey: ["booking", accountKey], refetchType: "none" });
      if (booking) {
        queryClient.setQueryData(["booking", accountKey, uid], booking);
      } else {
        void queryClient.invalidateQueries({ queryKey: ["booking", accountKey, uid] });
      }
      void queryClient.invalidateQueries({ queryKey: ["bookings", accountKey] });
    },
  });
}
