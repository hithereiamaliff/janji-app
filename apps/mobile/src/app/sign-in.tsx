import { useCallback, useEffect, useState } from "react";
import { BackHandler, Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiKeyStep } from "@/onboarding/ApiKeyStep";
import { ServerStep } from "@/onboarding/ServerStep";
import type { Server } from "@/session/account";
import { useTheme } from "@/theme/useTheme";

/**
 * Both sign-in steps live in this one route on purpose: the checked server is handed from step to step in
 * memory, never through URL parameters, so a crafted deep link can't point someone's API key at another
 * server.
 */
export default function SignInScreen() {
  const { colors } = useTheme();
  const [server, setServer] = useState<Server | null>(null);
  const [lastAddress, setLastAddress] = useState("");

  const backToServerStep = useCallback(() => {
    if (!server) return;
    setLastAddress(server.serverOrigin.replace(/^https?:\/\//, ""));
    setServer(null);
  }, [server]);

  // Android's back button should return to the server step rather than leave the app. Only Android has
  // one, and react-native-web logs an error if BackHandler is used at all.
  useEffect(() => {
    if (!server || Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      backToServerStep();
      return true;
    });
    return () => subscription.remove();
  }, [server, backToServerStep]);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={[styles.screen, { backgroundColor: colors.background }]}>
      {server ? (
        <ApiKeyStep server={server} onChangeServer={backToServerStep} />
      ) : (
        <ServerStep initialAddress={lastAddress} onServerFound={setServer} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
