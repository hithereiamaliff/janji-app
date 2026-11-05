import { useLocalSearchParams } from "expo-router";

import { EventTypeScreen } from "@/event-types/EventTypeScreen";

export default function EventTypeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventTypeScreen id={Number(id)} />;
}
