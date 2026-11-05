import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from "expo-router";

import type { ThemeColors } from "./colors";

// Headers, tab bars and screen backgrounds read their colours from the navigation theme, so mapping our
// palette here keeps dividers and cards from falling back to React Navigation's light defaults.
export function getNavigationTheme(isDark: boolean, colors: ThemeColors): NavigationTheme {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };
}
