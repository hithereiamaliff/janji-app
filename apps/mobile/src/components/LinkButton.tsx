import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "@/theme/useTheme";

type LinkButtonProps = {
  label: string;
  onPress: () => void;
  /** Centred under a screen's main button, instead of lined up with the form's left edge. */
  centered?: boolean;
  /** For a link that shows and hides something: whether it's showing. */
  expanded?: boolean;
};

/** A button that reads as a text link, for choices that matter less than the screen's main button. */
export function LinkButton({ label, onPress, centered = false, expanded }: LinkButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={({ pressed }) => [styles.link, centered && styles.centered, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.label, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 44 pt keeps the touch target at iOS's minimum even though the text is smaller.
  link: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  centered: {
    alignSelf: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
});
