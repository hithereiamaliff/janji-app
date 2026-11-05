import RootLayout from "@/app/_layout";
import TabsLayout from "@/app/(tabs)/_layout";
import AvailabilityScreen from "@/app/(tabs)/availability";
import EventTypesScreen from "@/app/(tabs)/event-types";
import BookingsScreen from "@/app/(tabs)/index";
import SettingsScreen from "@/app/(tabs)/settings";
import CancelBookingRoute from "@/app/booking/[uid]/cancel";
import DeclineBookingRoute from "@/app/booking/[uid]/decline";
import AddGuestsRoute from "@/app/booking/[uid]/guests";
import BookingRoute from "@/app/booking/[uid]/index";
import RescheduleRoute from "@/app/booking/[uid]/reschedule";
import EditEventTypeRoute from "@/app/event-type/[id]/edit";
import EventTypeRoute from "@/app/event-type/[id]/index";
import NewPrivateLinkRoute from "@/app/event-type/[id]/private-link";
import ProfileRoute from "@/app/profile";
import ScheduleDetailsRoute from "@/app/schedule/[id]/details";
import WeeklyHoursRoute from "@/app/schedule/[id]/hours";
import ScheduleRoute from "@/app/schedule/[id]/index";
import DateOverrideRoute from "@/app/schedule/[id]/override/[date]";
import NewDateOverrideRoute from "@/app/schedule/[id]/override/new";
import NewScheduleRoute from "@/app/schedule/new";
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
  "booking/[uid]/index": BookingRoute,
  "booking/[uid]/decline": DeclineBookingRoute,
  "booking/[uid]/cancel": CancelBookingRoute,
  "booking/[uid]/guests": AddGuestsRoute,
  "booking/[uid]/reschedule": RescheduleRoute,
  "event-type/[id]/index": EventTypeRoute,
  "event-type/[id]/edit": EditEventTypeRoute,
  "event-type/[id]/private-link": NewPrivateLinkRoute,
  "schedule/[id]/index": ScheduleRoute,
  "schedule/[id]/hours": WeeklyHoursRoute,
  "schedule/[id]/details": ScheduleDetailsRoute,
  "schedule/[id]/override/[date]": DateOverrideRoute,
  "schedule/[id]/override/new": NewDateOverrideRoute,
  "schedule/new": NewScheduleRoute,
  profile: ProfileRoute,
};
