import { useColorScheme } from "react-native";

import { darkColors, lightColors, type ThemeColors } from "./colors";

export type Theme = {
  isDark: boolean;
  colors: ThemeColors;
};

export function useTheme(): Theme {
  const isDark = useColorScheme() === "dark";
  return { isDark, colors: isDark ? darkColors : lightColors };
}
