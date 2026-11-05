import { useLocalSearchParams } from "expo-router";

import { ScheduleScreen } from "@/availability/ScheduleScreen";

export default function ScheduleRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ScheduleScreen id={Number(id)} />;
}
