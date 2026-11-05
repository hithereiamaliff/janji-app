import { useLocalSearchParams } from "expo-router";

import { DeclineBookingScreen } from "@/bookings/DeclineBookingScreen";

export default function DeclineBookingRoute() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return <DeclineBookingScreen uid={uid} />;
}
