import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

export type Choice<Value> = {
  value: Value;
  label: string;
  /** A second line, such as what the choice means. */
  detail?: string;
};

type ChoiceListProps<Value> = {
  choices: readonly Choice<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /** Names the group for screen readers. */
  accessibilityLabel: string;
  disabled?: boolean;
};

/** A list of radio buttons, one per row, for choices whose labels are too long to sit side by side. */
export function ChoiceList<Value extends string | number>({
  choices,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
}: ChoiceListProps<Value>) {
  const { colors } = useTheme();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.list}>
      {choices.map((choice) => {
        const checked = choice.value === value;
        return (
          <Pressable
            key={choice.value}
            accessibilityRole="radio"
            accessibilityLabel={choice.detail ? `${choice.label}, ${choice.detail}` : choice.label}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={() => onChange(choice.value)}
            style={({ pressed }) => [styles.row, { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}
          >
            <Ionicons
              name={checked ? "radio-button-on" : "radio-button-off"}
              size={22}
              color={checked ? colors.accent : colors.inputBorder}
            />
            <View style={styles.text}>
              <Text style={[styles.label, { color: colors.text }]}>{choice.label}</Text>
              {choice.detail ? (
                <Text style={[styles.detail, { color: colors.textMuted }]}>{choice.detail}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 2,
  },
  // 48 pt keeps each choice an easy touch target.
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 16,
  },
  detail: {
    fontSize: 14,
    lineHeight: 20,
  },
});
