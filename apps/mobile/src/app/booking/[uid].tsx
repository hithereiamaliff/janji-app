import { useLocalSearchParams } from "expo-router";

import { BookingDetailScreen } from "@/bookings/BookingDetailScreen";

export default function BookingRoute() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return <BookingDetailScreen uid={uid} />;
}
