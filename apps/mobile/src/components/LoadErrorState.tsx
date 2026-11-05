import { CalApiError } from "@janji/cal-api/errors";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { useSession } from "@/session/SessionProvider";
import { useTheme } from "@/theme/useTheme";

/** Explains the API errors that mean the same thing on every screen, or returns null for the others. */
export function loadErrorMessage(t: TFunction, error: unknown): string | null {
  if (!(error instanceof CalApiError)) return null;
  switch (error.kind) {
    case "unauthorized":
    case "network":
    case "server_error":
    case "not_cal_api":
      return t(`loadErrors.${error.kind}`);
    case "rate_limited":
      return error.retryAfterSeconds === null
        ? t("loadErrors.rate_limited_unknown")
        : t("loadErrors.rate_limited", { count: Math.ceil(error.retryAfterSeconds) });
    default:
      return null;
  }
}

type LoadErrorStateProps = {
  error: unknown;
  onRetry: () => void;
  /** Says what didn't load, for errors without a more specific explanation. */
  fallbackMessage: string;
  /** For things that can be deleted, such as a booking. */
  notFoundMessage?: string;
};

/**
 * Explains why something didn't load. A key that stopped working can only be fixed by signing in again,
 * and something that was deleted won't come back, so only the other failures offer "Try again".
 */
export function LoadErrorState({ error, onRetry, fallbackMessage, notFoundMessage }: LoadErrorStateProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { signOut } = useSession();
  const kind = error instanceof CalApiError ? error.kind : null;
  const gone = kind === "not_found" && notFoundMessage !== undefined;

  return (
    <View style={styles.container}>
      <Text accessibilityRole="alert" style={[styles.message, { color: colors.text }]}>
        {gone ? notFoundMessage : (loadErrorMessage(t, error) ?? fallbackMessage)}
      </Text>
      {kind === "unauthorized" ? (
        // A failed sign-out leaves the person signed in; Settings explains that case.
        <Button label={t("loadErrors.signInAgain")} onPress={() => signOut().catch(() => undefined)} />
      ) : gone ? null : (
        <Button variant="secondary" label={t("loadErrors.retry")} onPress={onRetry} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  message: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
});
