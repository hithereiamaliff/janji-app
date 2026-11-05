import { StyleSheet, Text } from "react-native";

type BadgeProps = {
  label: string;
  /** Used for both the text and the outline, so it must keep 4.5:1 contrast against the surface. */
  color: string;
};

export function Badge({ label, color }: BadgeProps) {
  return <Text style={[styles.badge, { color, borderColor: color }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    fontSize: 13,
    fontWeight: "600",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
});
