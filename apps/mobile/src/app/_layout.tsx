import "@/i18n";

import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { QueryProvider } from "@/data/QueryProvider";
import { SessionProvider, useSession } from "@/session/SessionProvider";
import { getNavigationTheme } from "@/theme/navigationTheme";
import { useTheme } from "@/theme/useTheme";

function RootNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { session } = useSession();

  // Rendering the navigator only once the saved session is known avoids flashing the sign-in screen at
  // people who are already signed in.
  if (session.status === "loading") {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.accent} />
      </View>
    );
  }

  const signedIn = session.status === "signedIn";
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="booking/[uid]/index"
          options={{
            headerShown: true,
            title: t("bookingDetail.screenTitle"),
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="event-type/[id]/index"
          options={{
            headerShown: true,
            title: t("eventTypes.screenTitle"),
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="schedule/[id]/index"
          options={{
            headerShown: true,
            title: t("availability.screenTitle"),
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        {/* Forms that change a booking open as modals over it, each with its own title and way back. */}
        <Stack.Screen name="booking/[uid]/decline" options={{ presentation: "modal" }} />
        <Stack.Screen name="booking/[uid]/cancel" options={{ presentation: "modal" }} />
        <Stack.Screen name="booking/[uid]/guests" options={{ presentation: "modal" }} />
        <Stack.Screen name="booking/[uid]/reschedule" options={{ presentation: "modal" }} />
        <Stack.Screen name="event-type/[id]/edit" options={{ presentation: "modal" }} />
        <Stack.Screen name="event-type/[id]/private-link" options={{ presentation: "modal" }} />
        <Stack.Screen name="schedule/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="schedule/[id]/hours" options={{ presentation: "modal" }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const { isDark, colors } = useTheme();

  return (
    <SessionProvider>
      <QueryProvider>
        <ThemeProvider value={getNavigationTheme(isDark, colors)}>
          <RootNavigator />
          <StatusBar style="auto" />
        </ThemeProvider>
      </QueryProvider>
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
