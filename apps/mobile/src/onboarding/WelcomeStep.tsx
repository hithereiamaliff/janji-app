import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { LinkButton } from "@/components/LinkButton";
import { useTheme } from "@/theme/useTheme";

import appIcon from "../../assets/icon.png";

type IconName = ComponentProps<typeof Ionicons>["name"];

const POINTS: readonly { key: "ownServer" | "onTheGo" | "notifications" | "noAccount"; icon: IconName }[] = [
  { key: "ownServer", icon: "server-outline" },
  { key: "onTheGo", icon: "calendar-outline" },
  { key: "notifications", icon: "notifications-outline" },
  { key: "noAccount", icon: "key-outline" },
];

type WelcomeStepProps = {
  onGetStarted: () => void;
  /** Explains what to do for someone without a Cal.diy server. */
  onNoServer: () => void;
};

/** What Janji is and why it exists, before someone connects a server for the first time. */
export function WelcomeStep({ onGetStarted, onNoServer }: WelcomeStepProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Image source={appIcon} style={styles.icon} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t("welcome.title")}
      </Text>
      <Text style={[styles.tagline, { color: colors.textMuted }]}>{t("welcome.tagline")}</Text>

      <View style={styles.points}>
        {POINTS.map(({ key, icon }) => {
          const title = t(`welcome.points.${key}.title`);
          const body = t(`welcome.points.${key}.body`);
          return (
            <View key={key} accessible accessibilityLabel={`${title}. ${body}`} style={styles.point}>
              <Ionicons name={icon} size={26} color={colors.accent} style={styles.pointIcon} />
              <View style={styles.pointText}>
                <Text style={[styles.pointTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.pointBody, { color: colors.textMuted }]}>{body}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <Button label={t("welcome.getStarted")} onPress={onGetStarted} />
      <LinkButton centered label={t("noServer.link")} onPress={onNoServer} />
      <Text style={[styles.footnote, { color: colors.textMuted }]}>{t("welcome.independent")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    paddingTop: 40,
    gap: 12,
  },
  icon: {
    width: 88,
    height: 88,
    borderRadius: 20,
  },
  title: {
    marginTop: 12,
    fontSize: 32,
    fontWeight: "700",
  },
  tagline: {
    fontSize: 18,
    lineHeight: 25,
  },
  points: {
    marginTop: 16,
    marginBottom: 12,
    gap: 20,
  },
  point: {
    flexDirection: "row",
    gap: 14,
  },
  pointIcon: {
    marginTop: 1,
  },
  pointText: {
    flex: 1,
    gap: 3,
  },
  pointTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  pointBody: {
    fontSize: 15,
    lineHeight: 21,
  },
  footnote: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
