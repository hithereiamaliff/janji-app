import { useLocalSearchParams } from "expo-router";

import { CancelBookingScreen } from "@/bookings/CancelBookingScreen";

export default function CancelBookingRoute() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return <CancelBookingScreen uid={uid} />;
}
