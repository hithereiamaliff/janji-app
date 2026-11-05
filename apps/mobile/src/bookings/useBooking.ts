import { useQuery } from "@tanstack/react-query";

import { useAccountKey } from "@/data/useAccountKey";
import { useCalClient } from "@/session/SessionProvider";

import { fetchBooking } from "./bookings-api";

/** One booking's full details, keyed by the signed-in account and the booking's uid. */
export function useBooking(uid: string) {
  const client = useCalClient();
  const accountKey = useAccountKey();

  return useQuery({
    queryKey: ["booking", accountKey, uid],
    queryFn: () => fetchBooking(client, uid),
  });
}
