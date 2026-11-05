import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/useTheme";

type IconName = ComponentProps<typeof Ionicons>["name"];

type TabBarIconProps = {
  focused: boolean;
  size: number;
};

// The tab bar passes a ColorValue (which may be a number or null) that the icon's color prop rejects, so
// the icon picks the same theme colours the tab bar tints with.
function renderTabIcon(name: IconName, colors: ThemeColors) {
  return ({ focused, size }: TabBarIconProps) => (
    <Ionicons name={name} size={size} color={focused ? colors.accent : colors.textMuted} />
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      // Backgrounds, header and dividers come from the navigation theme set in the root layout. The
      // inactive tint is explicit because the default is a translucent text colour with too little contrast.
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("tabs.bookings"), tabBarIcon: renderTabIcon("calendar-outline", colors) }}
      />
      <Tabs.Screen
        name="event-types"
        options={{ title: t("tabs.eventTypes"), tabBarIcon: renderTabIcon("link-outline", colors) }}
      />
      <Tabs.Screen
        name="availability"
        options={{ title: t("tabs.availability"), tabBarIcon: renderTabIcon("time-outline", colors) }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t("tabs.settings"), tabBarIcon: renderTabIcon("settings-outline", colors) }}
      />
    </Tabs>
  );
}
