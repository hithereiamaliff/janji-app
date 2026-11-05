import { useLocalSearchParams } from "expo-router";

import { RescheduleScreen } from "@/bookings/RescheduleScreen";

export default function RescheduleRoute() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return <RescheduleScreen uid={uid} />;
}
