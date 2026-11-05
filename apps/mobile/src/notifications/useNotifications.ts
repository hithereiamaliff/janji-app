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
import { pushSetup } from "./push-setup";
import { loadPushRegistration, type PushRegistration } from "./registration-storage";
import { createRelayClient } from "./relay-client";
import type { HookTrigger } from "./webhooks-api";

export type NotificationsState =
  /** On web, and in builds made without a relay or an EAS project. */
  | { status: "unavailable" }
  | { status: "off"; permission: PushPermission }
  | { status: "on"; permission: PushPermission; registration: PushRegistration };

function useNotificationsKey() {
  return ["notifications", useAccountKey()] as const;
}

/** Whether this phone gets the signed-in account's notifications, and whether the phone allows them. */
export function useNotifications() {
  const account = useSignedInAccount();
  return useQuery({
    queryKey: useNotificationsKey(),
    queryFn: async (): Promise<NotificationsState> => {
      if (!pushSetup()) return { status: "unavailable" };
      const [registration, permission] = await Promise.all([loadPushRegistration(), readPushPermission()]);
      if (registration && belongsTo(registration, account)) return { status: "on", permission, registration };
      return { status: "off", permission };
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
    mutationFn: () => {
      const setup = pushSetup();
      if (!setup) throw new Error("This build of Janji has no notifications");
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
    const setup = pushSetup();
    if (!setup) return;
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
    return onPushTokenChange(sync);
  }, [calClient, serverOrigin, userId, accountKey, languageTag, queryClient]);
}
