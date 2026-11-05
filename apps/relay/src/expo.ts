import type { Alert } from "./alert";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Sends the alert to the phone through Expo's push service. */
export async function sendAlert(env: Cloudflare.Env, pushToken: string, alert: Alert): Promise<void> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      // Only needed once "enhanced push security" is turned on for the Expo project.
      ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify({ to: pushToken, ...alert, sound: "default", priority: "high" }),
  });
  if (!response.ok) throw new Error(`Expo refused the push with ${response.status}`);
}
