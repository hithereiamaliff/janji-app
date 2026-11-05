import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useCalClient, useSession } from "@/session/SessionProvider";

import type { BookingSummary } from "./booking";
import { type BookingFilter, fetchBookingsPage } from "./bookings-api";

/** Identifies the signed-in account in query keys, so two accounts' data never share a cache entry. */
function useAccountKey(): string {
  const { session } = useSession();
  return session.status === "signedIn"
    ? `${session.account.serverOrigin}#${session.account.user.id}`
    : "signed-out";
}

/** Bookings for one filter, a page at a time; `bookings` is every page loaded so far, in order. */
export function useBookings(filter: BookingFilter, search = "") {
  const client = useCalClient();
  const accountKey = useAccountKey();
  const trimmedSearch = search.trim();

  const query = useInfiniteQuery({
    queryKey: ["bookings", accountKey, filter, trimmedSearch],
    queryFn: ({ pageParam }) => fetchBookingsPage(client, { filter, page: pageParam, search: trimmedSearch }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
  });

  const bookings = useMemo<BookingSummary[]>(
    () => query.data?.pages.flatMap((page) => page.bookings) ?? [],
    [query.data]
  );

  return { ...query, bookings };
}
