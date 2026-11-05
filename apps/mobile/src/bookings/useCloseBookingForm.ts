import { useRouter } from "expo-router";

/**
 * Leaves one of a booking's forms for the booking itself. A form opened straight from a link has nothing
 * behind it to go back to, so it opens the booking instead.
 */
export function useCloseBookingForm(uid: string): () => void {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({ pathname: "/booking/[uid]", params: { uid } });
    }
  };
}
