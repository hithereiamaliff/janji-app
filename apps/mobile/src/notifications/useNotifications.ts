import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocales } from "expo-localization";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAccountKey } from "@/data/useAccountKey";
import { useCalClient, useSignedInAccount } from "@/session/SessionProvider";

import {
  belongsTo,
  chooseNotificationEvents,
  syncNotifications,
  turnOffNotifications,
  turnOnNotifications,
} from "./notifications";
import { onPushTokenChange, type PushPermission, readPushPermission } from "./push";
import { loadPushSetup, pushBuild } from "./push-setup";
import { loadPushRegistration, type PushRegistration } from "./registration-storage";
import { createRelayClient } from "./relay-client";
import { loadRelayChoice, saveRelayChoice } from "./relay-setting";
import type { HookTrigger } from "./webhooks-api";

/** Which relay notifications go through. */
export type RelayInfo = {
  /** The one in use: chosen under Advanced, or else the build's. Null when there's neither. */
  origin: string | null;
  /** The relay the build was made with, if any. */
  buildOrigin: string | null;
};

export type NotificationsState =
  /** On web, and in builds made without an EAS project. */
  | { status: "unavailable" }
  | { status: "off"; permission: PushPermission; relay: RelayInfo }
  | { status: "on"; permission: PushPermission; relay: RelayInfo; registration: PushRegistration };

function useNotificationsKey() {
  return ["notifications", useAccountKey()] as const;
}

/** Whether this phone gets the signed-in account's notifications, and whether the phone allows them. */
export function useNotifications() {
  const account = useSignedInAccount();
  return useQuery({
    queryKey: useNotificationsKey(),
    queryFn: async (): Promise<NotificationsState> => {
      const build = pushBuild();
      if (!build) return { status: "unavailable" };
      const [registration, permission, chosen] = await Promise.all([
        loadPushRegistration(),
        readPushPermission(),
        loadRelayChoice(),
      ]);
      const relay = { origin: chosen ?? build.relayOrigin, buildOrigin: build.relayOrigin };
      if (registration && belongsTo(registration, account)) {
        return { status: "on", permission, relay, registration };
      }
      return { status: "off", permission, relay };
    },
    // Reading it is cheap and stays on the phone, and the person may change the permission in the phone's
    // settings while Janji is in the background, so it's read again each time the app comes back.
    staleTime: 0,
  });
}

export function useTurnOnNotifications() {
  const calClient = useCalClient();
  const account = useSignedInAccount();
  const [{ languageTag }] = useLocales();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = useNotificationsKey();

  return useMutation({
    mutationFn: async () => {
      const setup = await loadPushSetup();
      if (!setup) throw new Error("Janji has no relay to send notifications through");
      return turnOnNotifications({
        calClient,
        relay: createRelayClient(setup.relayOrigin),
        setup,
        account,
        locale: languageTag,
        channelName: t("notifications.channel"),
      });
    },
    retry: false,
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export function useTurnOffNotifications() {
  const calClient = useCalClient();
  const queryClient = useQueryClient();
  const queryKey = useNotificationsKey();

  return useMutation({
    mutationFn: () => turnOffNotifications({ calClient }),
    retry: false,
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

/**
 * Chooses the relay notifications go through, or with null goes back to the build's. It's for when
 * notifications are off: one that's on stays registered with the relay it was turned on with.
 */
export function useChooseRelay() {
  const queryClient = useQueryClient();
  const queryKey = useNotificationsKey();

  return useMutation({
    mutationFn: (origin: string | null) => saveRelayChoice(origin),
    retry: false,
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export function useChooseNotificationEvents() {
  const calClient = useCalClient();
  const queryClient = useQueryClient();
  const queryKey = useNotificationsKey();

  return useMutation({
    mutationFn: (triggers: readonly HookTrigger[]) => chooseNotificationEvents(calClient, triggers),
    retry: false,
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

/**
 * Keeps this phone's notifications working while signed in: syncs as the app starts, and again when the
 * phone gets a new push token or language.
 */
export function useNotificationsSync() {
  const calClient = useCalClient();
  const { serverOrigin, user } = useSignedInAccount();
  const userId = user.id;
  const accountKey = useAccountKey();
  const [{ languageTag }] = useLocales();
  const queryClient = useQueryClient();

  useEffect(() => {
    let stopListening: () => void = () => undefined;
    let stopped = false;
    loadPushSetup()
      .then((setup) => {
        if (!setup || stopped) return;
        let queue = Promise.resolve();
        const sync = () => {
          queue = queue
            .then(() =>
              syncNotifications({
                calClient,
                setup,
                account: { serverOrigin, user: { id: userId } },
                locale: languageTag,
              })
            )
            // One that fails, as when offline, is tried again at the next start.
            .catch(() => undefined)
            .then(() => queryClient.invalidateQueries({ queryKey: ["notifications", accountKey] }));
        };
        sync();
        stopListening = onPushTokenChange(sync);
      })
      // Without a readable relay choice there's nothing to sync with; the next start tries again.
      .catch(() => undefined);
    return () => {
      stopped = true;
      stopListening();
    };
  }, [calClient, serverOrigin, userId, accountKey, languageTag, queryClient]);
}
