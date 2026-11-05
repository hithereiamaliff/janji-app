import { useLocalSearchParams } from "expo-router";

import { NewPrivateLinkScreen } from "@/event-types/NewPrivateLinkScreen";

export default function NewPrivateLinkRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NewPrivateLinkScreen id={Number(id)} />;
}
