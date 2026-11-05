import RootLayout from "@/app/_layout";
import TabsLayout from "@/app/(tabs)/_layout";
import AvailabilityScreen from "@/app/(tabs)/availability";
import EventTypesScreen from "@/app/(tabs)/event-types";
import BookingsScreen from "@/app/(tabs)/index";
import SettingsScreen from "@/app/(tabs)/settings";
import SignInScreen from "@/app/sign-in";

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
