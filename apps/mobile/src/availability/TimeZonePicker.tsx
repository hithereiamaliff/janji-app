import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { timeZoneCity } from "@/bookings/format";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { useTheme } from "@/theme/useTheme";

import { searchCities } from "./city-search";
import { useCityTimeZones } from "./useCityTimeZones";

type TimeZonePickerProps = {
  /** An IANA time zone, such as "Asia/Kuala_Lumpur". */
  value: string;
  onChange: (timeZone: string) => void;
  disabled?: boolean;
};

function zoneText(timeZone: string): string {
  return `${timeZoneCity(timeZone)} (${timeZone})`;
}

/** A time zone, shown as a button that opens a search of the cities Cal.diy offers. */
export function TimeZonePicker({ value, onChange, disabled = false }: TimeZonePickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cities = useCityTimeZones();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchCities(cities.data ?? [], query), [cities.data, query]);
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function choose(timeZone: string) {
    onChange(timeZone);
    setOpen(false);
    setQuery("");
  }

  let list: ReactNode;
  if (cities.isPending) {
    list = <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />;
  } else if (cities.isError) {
    list = (
      <View style={styles.group}>
        <Text accessibilityRole="alert" style={[styles.note, { color: colors.danger }]}>
          {t("timeZonePicker.loadFailed")}
        </Text>
        <Button variant="secondary" label={t("loadErrors.retry")} onPress={() => void cities.refetch()} />
      </View>
    );
  } else if (!query.trim()) {
    list = <Text style={[styles.note, { color: colors.textMuted }]}>{t("timeZonePicker.searchHint")}</Text>;
  } else if (results.length === 0) {
    list = (
      <Text style={[styles.note, { color: colors.textMuted }]}>
        {t("timeZonePicker.noMatch", { query: query.trim() })}
      </Text>
    );
  } else {
    list = results.map((entry) => {
      const selected = entry.timeZone === value;
      return (
        <Pressable
          key={`${entry.city} ${entry.timeZone}`}
          accessibilityRole="button"
          accessibilityLabel={`${entry.city}, ${entry.timeZone}`}
          accessibilityState={{ selected }}
          onPress={() => choose(entry.timeZone)}
          style={({ pressed }) => [
            styles.result,
            { backgroundColor: selected ? colors.accent : "transparent", opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.city, { color: selected ? colors.onAccent : colors.text }]}>{entry.city}</Text>
          <Text style={[styles.note, { color: selected ? colors.onAccent : colors.textMuted }]}>
            {entry.timeZone}
          </Text>
        </Pressable>
      );
    });
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("timeZonePicker.label", { zone: zoneText(value) })}
        accessibilityHint={t("timeZonePicker.hint")}
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
        <Text style={[styles.fieldText, { color: colors.text }]}>{zoneText(value)}</Text>
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
              {t("timeZonePicker.title")}
            </Text>
            <TextField
              label={t("timeZonePicker.searchLabel")}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoFocus
            />
            {deviceZone && deviceZone !== value ? (
              <Button
                variant="secondary"
                label={t("timeZonePicker.useDevice", { zone: timeZoneCity(deviceZone) })}
                onPress={() => choose(deviceZone)}
              />
            ) : null}
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {list}
            </ScrollView>
            <Button variant="secondary" label={t("timePicker.cancel")} onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // 48 pt tall keeps the field an easy touch target.
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
  },
  fieldText: {
    fontSize: 16,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheet: {
    maxHeight: "85%",
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
  group: {
    gap: 12,
  },
  result: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
  },
  city: {
    fontSize: 16,
    fontWeight: "600",
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
  },
});
