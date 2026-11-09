import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { useTheme } from "@/theme/useTheme";

type InfoCardProps = {
  title: string;
  body: string;
  /** Numbers the card, for steps that go in order. */
  step?: number;
  action?: { label: string; onPress: () => void };
};

/** A card that explains one thing, with an optional button to act on it. */
export function InfoCard({ title, body, step, action }: InfoCardProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {step === undefined ? title : `${step}. ${title}`}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{body}</Text>
      {action ? <Button variant="secondary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
});
