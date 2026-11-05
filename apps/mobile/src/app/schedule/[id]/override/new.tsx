import { useLocalSearchParams } from "expo-router";

import { DateOverrideScreen } from "@/availability/DateOverrideScreen";

export default function NewDateOverrideRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DateOverrideScreen id={Number(id)} />;
}
