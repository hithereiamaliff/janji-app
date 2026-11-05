import "@/i18n";

import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { getNavigationTheme } from "@/theme/navigationTheme";
import { useTheme } from "@/theme/useTheme";

export default function RootLayout() {
  const { isDark, colors } = useTheme();

  return (
    <ThemeProvider value={getNavigationTheme(isDark, colors)}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
