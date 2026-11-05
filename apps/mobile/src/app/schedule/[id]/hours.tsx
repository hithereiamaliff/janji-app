import { useLocalSearchParams } from "expo-router";

import { WeeklyHoursScreen } from "@/availability/WeeklyHoursScreen";

export default function WeeklyHoursRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WeeklyHoursScreen id={Number(id)} />;
}
