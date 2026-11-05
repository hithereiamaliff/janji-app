import type { CityTimeZone } from "@janji/cal-api/timezones";

/** The most results a search shows; more would mean typing a little more anyway. */
export const MAX_RESULTS = 50;

/**
 * Cities matching what was typed: those whose name starts with it first, then those with it anywhere in
 * their name or time zone, so "lum" finds Kuala Lumpur and "london" finds Europe/London's cities.
 */
export function searchCities(cities: readonly CityTimeZone[], query: string): CityTimeZone[] {
  const typed = query.trim().toLowerCase();
  if (!typed) return [];
  const starting: CityTimeZone[] = [];
  const containing: CityTimeZone[] = [];
  for (const entry of cities) {
    const city = entry.city.toLowerCase();
    if (city.startsWith(typed)) starting.push(entry);
    else if (city.includes(typed) || entry.timeZone.toLowerCase().replace(/_/g, " ").includes(typed)) {
      containing.push(entry);
    }
    if (starting.length >= MAX_RESULTS) break;
  }
  return [...starting, ...containing].slice(0, MAX_RESULTS);
}
