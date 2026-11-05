import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { useTheme } from "@/theme/useTheme";

export type FilterTabOption<Value extends string> = {
  value: Value;
  label: string;
};

type FilterTabsProps<Value extends string> = {
  options: readonly FilterTabOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /** Names the group for screen readers, e.g. "Which bookings to show". */
  accessibilityLabel: string;
};

/**
 * A row of pill-shaped tabs that scrolls sideways when the labels don't fit, which keeps longer
 * translations readable instead of squeezing them into equal-width segments.
 */
export function FilterTabs<Value extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: FilterTabsProps<Value>) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={styles.scroller}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.tab,
              {
                backgroundColor: selected ? colors.accent : colors.surface,
                borderColor: selected ? colors.accent : colors.inputBorder,
              },
            ]}
          >
            <Text style={[styles.label, { color: selected ? colors.onAccent : colors.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ScrollView grows by default; in a column that makes the tabs share the screen's height with the list.
  scroller: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tab: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
});
