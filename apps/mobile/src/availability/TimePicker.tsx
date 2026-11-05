import { useLocales } from "expo-localization";
import { type ComponentRef, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { useTheme } from "@/theme/useTheme";

import { clockTime } from "./hours-text";
import { TIME_CHOICES } from "./weekly-hours-form";

/** Each time in the list is this tall, so the list can open scrolled to the current one. */
const ROW_HEIGHT = 48;

type TimePickerProps = {
  /** What the time is for, read before it by screen readers, e.g. "Monday, start". */
  label: string;
  /** The list's title, e.g. "Start time". */
  title: string;
  /** "HH:mm" on the schedule's clock. */
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
};

/** A time, shown as a button that opens the list of times on offer. */
export function TimePicker({ label, title, value, onChange, disabled = false }: TimePickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [{ languageTag: locale }] = useLocales();
  const [open, setOpen] = useState(false);
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  // A time set on the web with another interval still shows, in its place, so it can be kept.
  const choices = TIME_CHOICES.includes(value) ? TIME_CHOICES : [...TIME_CHOICES, value].sort();
  const shown = clockTime(value, locale);

  function choose(time: string) {
    onChange(time);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${shown}`}
        accessibilityHint={t("timePicker.hint")}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor: colors.inputBorder,
            opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[styles.fieldText, { color: colors.text }]}>{shown}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
              {title}
            </Text>
            <ScrollView
              ref={list}
              style={styles.list}
              onLayout={() =>
                list.current?.scrollTo({
                  y: Math.max(choices.indexOf(value) - 2, 0) * ROW_HEIGHT,
                  animated: false,
                })
              }
            >
              {choices.map((time) => {
                const selected = time === value;
                return (
                  <Pressable
                    key={time}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => choose(time)}
                    style={({ pressed }) => [
                      styles.choice,
                      {
                        backgroundColor: selected ? colors.accent : "transparent",
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.choiceText, { color: selected ? colors.onAccent : colors.text }]}>
                      {clockTime(time, locale)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button variant="secondary" label={t("timePicker.cancel")} onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // 48 pt tall keeps the time an easy touch target.
  field: {
    minHeight: 48,
    minWidth: 112,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldText: {
    fontSize: 16,
    fontWeight: "600",
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheet: {
    maxHeight: "70%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
  list: {
    flexGrow: 0,
  },
  choice: {
    height: ROW_HEIGHT,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  choiceText: {
    fontSize: 16,
  },
});
