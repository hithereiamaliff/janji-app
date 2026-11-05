import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

/** A titled card, as on the booking and event type screens. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textMuted }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
});
