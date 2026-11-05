import { useLocalSearchParams } from "expo-router";

import { ScheduleDetailsScreen } from "@/availability/ScheduleDetailsScreen";

export default function ScheduleDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ScheduleDetailsScreen id={Number(id)} />;
}
