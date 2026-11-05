import type { ComponentRef, Ref } from "react";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

type TextFieldProps = Omit<TextInputProps, "style" | "accessibilityLabel"> & {
  label: string;
  /** Extra guidance shown under the field and read by screen readers. */
  hint?: string;
  /** Shown under the field and announced when it changes. */
  error?: string | null;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

export function TextField({ label, hint, error, ref, ...inputProps }: TextFieldProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.inputBorder,
          },
        ]}
        {...inputProps}
      />
      {hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.error, { color: colors.danger }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});
