import { Platform, Switch, type SwitchProps } from "react-native";

import { useTheme } from "@/theme/useTheme";

/**
 * A Switch in the app's colours. Android would otherwise tint it with the system's accent colour, while iOS
 * keeps its own white thumb.
 */
export function ThemedSwitch(props: Omit<SwitchProps, "trackColor" | "thumbColor">) {
  const { colors } = useTheme();
  return (
    <Switch
      trackColor={{ false: colors.inputBorder, true: colors.accent }}
      thumbColor={Platform.OS === "ios" ? undefined : "#FFFFFF"}
      {...props}
    />
  );
}
