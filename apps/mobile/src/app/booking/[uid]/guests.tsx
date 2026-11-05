import { useLocalSearchParams } from "expo-router";

import { AddGuestsScreen } from "@/bookings/AddGuestsScreen";

export default function AddGuestsRoute() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return <AddGuestsScreen uid={uid} />;
}
