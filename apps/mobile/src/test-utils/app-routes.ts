import RootLayout from "@/app/_layout";
import TabsLayout from "@/app/(tabs)/_layout";
import AvailabilityScreen from "@/app/(tabs)/availability";
import EventTypesScreen from "@/app/(tabs)/event-types";
import BookingsScreen from "@/app/(tabs)/index";
import SettingsScreen from "@/app/(tabs)/settings";
import SignInScreen from "@/app/sign-in";
import type { Account } from "@/session/account";

/** The app's real routes, for expo-router's renderRouter in tests. */
export const appRoutes = {
  _layout: RootLayout,
  "sign-in": SignInScreen,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/index": BookingsScreen,
  "(tabs)/event-types": EventTypesScreen,
  "(tabs)/availability": AvailabilityScreen,
  "(tabs)/settings": SettingsScreen,
};

export const testAccount: Account = {
  serverOrigin: "https://book.example.com",
  apiRootUrl: "https://book.example.com/api",
  user: { id: 7, username: "alan", name: "Alan", email: "alan@example.com", timeZone: "Asia/Kuala_Lumpur" },
};

/** A GET /v2/me body for testAccount. */
export const testMeResponse = {
  status: "success",
  data: {
    id: 7,
    username: "alan",
    email: "alan@example.com",
    name: "Alan",
    avatarUrl: null,
    bio: null,
    timeFormat: 12,
    defaultScheduleId: 1,
    weekStart: "Monday",
    timeZone: "Asia/Kuala_Lumpur",
    organizationId: null,
  },
};

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}
