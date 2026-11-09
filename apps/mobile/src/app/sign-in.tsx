import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiKeyStep } from "@/onboarding/ApiKeyStep";
import { ServerStep } from "@/onboarding/ServerStep";
import { WelcomeStep } from "@/onboarding/WelcomeStep";
import { loadWelcomeSeen, saveWelcomeSeen } from "@/onboarding/welcome-storage";
import type { Server } from "@/session/account";
import { useTheme } from "@/theme/useTheme";

/** "loading" until storage says whether this phone has seen the welcome; "reopened" when asked for again. */
type Welcome = "loading" | "firstTime" | "reopened" | "closed";

/**
 * Both sign-in steps live in this one route on purpose: the checked server is handed from step to step in
 * memory, never through URL parameters, so a crafted deep link can't point someone's API key at another
 * server. The welcome comes first, once per phone; after that, signing out leads straight to the server step.
 */
export default function SignInScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [server, setServer] = useState<Server | null>(null);
  const [lastAddress, setLastAddress] = useState("");
  const [welcome, setWelcome] = useState<Welcome>("loading");

  useEffect(() => {
    let active = true;
    loadWelcomeSeen().then((seen) => {
      if (active) setWelcome(seen ? "closed" : "firstTime");
    });
    return () => {
      active = false;
    };
  }, []);

  const closeWelcome = useCallback(() => {
    setWelcome("closed");
    // Only a convenience: if it can't be saved, the welcome shows once more next time.
    saveWelcomeSeen().catch(() => undefined);
  }, []);

  const reopenWelcome = useCallback((address: string) => {
    setLastAddress(address);
    setWelcome("reopened");
  }, []);

  const openNoServer = useCallback(() => router.push("/no-server"), [router]);

  const backToServerStep = useCallback(() => {
    if (!server) return;
    setLastAddress(server.serverOrigin.replace(/^https?:\/\//, ""));
    setServer(null);
  }, [server]);

  // Android's back button should return to the server step rather than leave the app. Only Android has
  // one, and react-native-web logs an error if BackHandler is used at all. Listening only while this screen
  // is focused leaves the back button to the navigator when a screen opens over it.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android" || (!server && welcome !== "reopened")) return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (server) backToServerStep();
        else setWelcome("closed");
        return true;
      });
      return () => subscription.remove();
    }, [server, welcome, backToServerStep])
  );

  function currentStep() {
    if (server) return <ApiKeyStep server={server} onChangeServer={backToServerStep} />;
    if (welcome === "loading") return null;
    if (welcome !== "closed") return <WelcomeStep onGetStarted={closeWelcome} onNoServer={openNoServer} />;
    return (
      <ServerStep
        initialAddress={lastAddress}
        onServerFound={setServer}
        onShowWelcome={reopenWelcome}
        onNoServer={openNoServer}
      />
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={[styles.screen, { backgroundColor: colors.background }]}>
      {currentStep()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
