import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/useTheme";

export type ButtonVariant = "primary" | "secondary" | "destructive";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Shows a spinner and blocks presses, e.g. while a request is running. */
  loading?: boolean;
  disabled?: boolean;
  /** Read by screen readers when the label alone doesn't say what happens. */
  accessibilityHint?: string;
};

function paletteFor(variant: ButtonVariant, colors: ThemeColors) {
  switch (variant) {
    case "primary":
      return { background: colors.accent, border: colors.accent, text: colors.onAccent };
    case "secondary":
      return { background: colors.surface, border: colors.inputBorder, text: colors.accent };
    case "destructive":
      return { background: colors.surface, border: colors.inputBorder, text: colors.danger };
  }
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const palette = paletteFor(variant, colors);
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: inactive ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 48 pt keeps the touch target above the 44 pt (iOS) and 48 dp (Android) minimums.
  button: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
