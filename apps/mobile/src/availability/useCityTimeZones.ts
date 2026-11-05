import { fetchCityTimeZones } from "@janji/cal-api/timezones";
import { useQuery } from "@tanstack/react-query";

import { useSignedInAccount } from "@/session/SessionProvider";

/** The cities Cal.diy offers time zones by. They only change with its city data, so one fetch lasts. */
export function useCityTimeZones() {
  const { apiRootUrl } = useSignedInAccount();
  return useQuery({
    queryKey: ["cityTimeZones", apiRootUrl],
    queryFn: () => fetchCityTimeZones(apiRootUrl),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
