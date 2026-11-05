import { useLocalSearchParams } from "expo-router";

import { EditEventTypeScreen } from "@/event-types/EditEventTypeScreen";

export default function EditEventTypeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditEventTypeScreen id={Number(id)} />;
}
