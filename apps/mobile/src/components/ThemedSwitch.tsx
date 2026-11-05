import { Platform, Switch, type SwitchProps } from "react-native";

import { useTheme } from "@/theme/useTheme";

/**
 * A Switch in the app's colours. Android would otherwise tint it with the system's accent colour, while iOS
 * keeps its own white thumb. It also states when it's disabled, which React Native's Switch only does on
 * Android.
 */
export function ThemedSwitch(props: Omit<SwitchProps, "trackColor" | "thumbColor">) {
  const { colors } = useTheme();
  return (
    <Switch
      trackColor={{ false: colors.inputBorder, true: colors.accent }}
      thumbColor={Platform.OS === "ios" ? undefined : "#FFFFFF"}
      {...props}
      accessibilityState={{ ...props.accessibilityState, disabled: props.disabled === true }}
    />
  );
}
