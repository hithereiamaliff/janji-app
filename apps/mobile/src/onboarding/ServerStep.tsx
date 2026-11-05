import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";

import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { TextField } from "@/components/TextField";
import type { Server } from "@/session/account";
import { checkServer, type ServerCheckFailure } from "@/session/sign-in";
import { useTheme } from "@/theme/useTheme";

type ServerStepProps = {
  initialAddress?: string;
  onServerFound: (server: Server) => void;
};

/** Sign-in step 1: find the person's Cal.diy server and check that Cal API v2 answers there. */
export function ServerStep({ initialAddress = "", onServerFound }: ServerStepProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [address, setAddress] = useState(initialAddress);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [apiV2Address, setApiV2Address] = useState("");
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<ServerCheckFailure | null>(null);

  async function handleContinue() {
    if (checking) return;
    setChecking(true);
    setFailure(null);
    const result = await checkServer(address, { apiV2Address: showAdvanced ? apiV2Address : undefined });
    setChecking(false);
    if (result.ok) {
      onServerFound(result.server);
    } else {
      setFailure(result.reason);
    }
  }

  const apiAddressError =
    failure === "api_address_invalid" ? t("signIn.server.errors.api_address_invalid") : null;
  const addressError =
    failure !== null && failure !== "api_address_invalid" ? t(`signIn.server.errors.${failure}`) : null;
  const advancedLabel = showAdvanced ? t("signIn.server.advancedHide") : t("signIn.server.advancedShow");

  return (
    <FormScreen title={t("signIn.server.title")} description={t("signIn.server.description")}>
      <TextField
        label={t("signIn.server.addressLabel")}
        placeholder={t("signIn.server.addressPlaceholder")}
        value={address}
        onChangeText={setAddress}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="url"
        keyboardType="url"
        textContentType="URL"
        returnKeyType="go"
        onSubmitEditing={handleContinue}
        error={addressError}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={advancedLabel}
        accessibilityState={{ expanded: showAdvanced }}
        onPress={() => setShowAdvanced((shown) => !shown)}
        style={styles.toggle}
      >
        <Text style={[styles.toggleLabel, { color: colors.accent }]}>{advancedLabel}</Text>
      </Pressable>

      {showAdvanced ? (
        <TextField
          label={t("signIn.server.apiAddressLabel")}
          hint={t("signIn.server.apiAddressHint")}
          placeholder="https://api.example.com/v2"
          value={apiV2Address}
          onChangeText={setApiV2Address}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          textContentType="URL"
          error={apiAddressError}
        />
      ) : null}

      <Button label={t("signIn.server.continue")} onPress={handleContinue} loading={checking} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  toggle: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
});
