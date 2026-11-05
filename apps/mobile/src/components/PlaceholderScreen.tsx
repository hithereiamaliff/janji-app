import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

type PlaceholderScreenProps = {
  message: string;
};

export function PlaceholderScreen({ message }: PlaceholderScreenProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
});
