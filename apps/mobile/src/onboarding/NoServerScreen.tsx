import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { CAL_COM_APP_URL, openInBrowser, SERVER_SETUP_URL } from "@/lib/links";
import { useTheme } from "@/theme/useTheme";

type OptionProps = {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
};

function Option({ title, body, action }: OptionProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.option, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.optionTitle, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.optionBody, { color: colors.textMuted }]}>{body}</Text>
      {action ? <Button variant="secondary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

/** For people who reach sign-in without a Cal.diy server: what to do instead, or how to get one. */
export function NoServerScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace("/sign-in");
  }

  return (
    <FormScreen title={t("noServer.title")} description={t("noServer.description")}>
      <Option
        title={t("noServer.calCom.title")}
        body={t("noServer.calCom.body")}
        action={{
          label: t("noServer.calCom.action"),
          onPress: () => {
            Linking.openURL(CAL_COM_APP_URL).catch(() => undefined);
          },
        }}
      />
      <Option title={t("noServer.team.title")} body={t("noServer.team.body")} />
      <Option
        title={t("noServer.ownServer.title")}
        body={t("noServer.ownServer.body")}
        action={{ label: t("noServer.ownServer.action"), onPress: () => openInBrowser(SERVER_SETUP_URL) }}
      />
      <Button variant="secondary" label={t("bookingActions.goBack")} onPress={close} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  option: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  optionBody: {
    fontSize: 15,
    lineHeight: 21,
  },
});
