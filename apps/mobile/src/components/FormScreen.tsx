import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

type FormScreenProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** A scrollable form page with a title, kept clear of the on-screen keyboard. */
export function FormScreen({ title, description, children }: FormScreenProps) {
  const { colors } = useTheme();

  return (
    <KeyboardAvoidingView
      // Android already resizes the window for the keyboard; iOS needs the view to add padding itself.
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
        {description ? (
          <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
        ) : null}
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  description: {
    fontSize: 16,
    lineHeight: 23,
  },
  body: {
    marginTop: 12,
    gap: 20,
  },
});
