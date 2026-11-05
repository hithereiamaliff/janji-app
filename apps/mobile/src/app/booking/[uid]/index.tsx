import { useLocalSearchParams } from "expo-router";

import { BookingDetailScreen } from "@/bookings/BookingDetailScreen";

export default function BookingRoute() {
  // notice is set when another screen opens this booking after changing it, such as after a reschedule.
  const { uid, notice } = useLocalSearchParams<{ uid: string; notice?: string }>();
  return <BookingDetailScreen uid={uid} notice={notice === "rescheduled" ? "rescheduled" : undefined} />;
}
