import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { TextField } from "@/components/TextField";
import type { Server } from "@/session/account";
import { useSession } from "@/session/SessionProvider";
import { type KeyCheckFailure, verifyApiKey } from "@/session/sign-in";
import { useTheme } from "@/theme/useTheme";

type ApiKeyStepProps = {
  server: Server;
  onChangeServer: () => void;
};

type Failure = {
  reason: KeyCheckFailure | "save_failed";
  retryAfterSeconds: number | null;
};

function failureMessage(t: TFunction, { reason, retryAfterSeconds }: Failure): string {
  if (reason === "rate_limited") {
    return retryAfterSeconds === null
      ? t("signIn.apiKey.errors.rate_limited_unknown")
      : t("signIn.apiKey.errors.rate_limited", { count: Math.ceil(retryAfterSeconds) });
  }
  return t(`signIn.apiKey.errors.${reason}`);
}

/** Sign-in step 2: get an API key for the checked server, verify it and sign in. */
export function ApiKeyStep({ server, onChangeServer }: ApiKeyStepProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { signIn } = useSession();
  const [apiKey, setApiKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  // Showing the host makes it obvious which server the key will be sent to.
  const host = server.serverOrigin.replace(/^https?:\/\//, "");

  async function openApiKeysPage() {
    await WebBrowser.openBrowserAsync(`${server.serverOrigin}/settings/developer/api-keys`);
  }

  async function pasteKey() {
    const text = await Clipboard.getStringAsync();
    if (text.trim() !== "") setApiKey(text.trim());
  }

  async function handleSignIn() {
    if (checking) return;
    setChecking(true);
    setFailure(null);
    const result = await verifyApiKey(server, apiKey);
    if (!result.ok) {
      setChecking(false);
      setFailure({ reason: result.reason, retryAfterSeconds: result.retryAfterSeconds });
      return;
    }
    try {
      // On success the sign-in guard swaps this screen for the app, so there is nothing to reset.
      await signIn(result.account, apiKey.trim());
    } catch {
      setChecking(false);
      setFailure({ reason: "save_failed", retryAfterSeconds: null });
    }
  }

  return (
    <FormScreen
      title={t("signIn.apiKey.title")}
      description={t("signIn.apiKey.description", { server: host })}
    >
      <View style={styles.steps}>
        {[t("signIn.apiKey.stepOpen"), t("signIn.apiKey.stepCreate"), t("signIn.apiKey.stepPaste")].map(
          (step) => (
            <Text key={step} style={[styles.step, { color: colors.text }]}>
              {step}
            </Text>
          )
        )}
      </View>

      <Button
        variant="secondary"
        label={t("signIn.apiKey.openApiKeys")}
        accessibilityHint={t("signIn.apiKey.openApiKeysHint", { server: host })}
        onPress={openApiKeysPage}
      />

      <TextField
        label={t("signIn.apiKey.keyLabel")}
        placeholder={t("signIn.apiKey.keyPlaceholder")}
        value={apiKey}
        onChangeText={setApiKey}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        // Keeps iOS and Android from offering saved passwords or suggesting a new one for the key field.
        autoComplete="off"
        textContentType="none"
        returnKeyType="go"
        onSubmitEditing={handleSignIn}
        error={failure ? failureMessage(t, failure) : null}
      />

      <Button
        variant="secondary"
        label={t("signIn.apiKey.paste")}
        accessibilityHint={t("signIn.apiKey.pasteHint")}
        onPress={pasteKey}
      />

      <Button label={t("signIn.apiKey.signIn")} onPress={handleSignIn} loading={checking} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("signIn.apiKey.changeServer")}
        onPress={onChangeServer}
        style={styles.link}
      >
        <Text style={[styles.linkLabel, { color: colors.accent }]}>{t("signIn.apiKey.changeServer")}</Text>
      </Pressable>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  steps: {
    gap: 8,
  },
  step: {
    fontSize: 16,
    lineHeight: 23,
  },
  link: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  linkLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
});
