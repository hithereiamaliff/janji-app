import { Redirect, useLocalSearchParams } from "expo-router";

import { DateOverrideScreen } from "@/availability/DateOverrideScreen";

export default function DateOverrideRoute() {
  const { id, date } = useLocalSearchParams<{ id: string; date: string }>();
  // Only a "YYYY-MM-DD" date can name an override; anything else goes back to the schedule.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return <Redirect href={{ pathname: "/schedule/[id]", params: { id } }} />;
  }
  return <DateOverrideScreen id={Number(id)} date={date} />;
}
