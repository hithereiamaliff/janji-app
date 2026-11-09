import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking } from "react-native";

import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { InfoCard } from "@/components/InfoCard";
import { CAL_COM_APP_URL } from "@/lib/links";

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
      <InfoCard
        title={t("noServer.calCom.title")}
        body={t("noServer.calCom.body")}
        action={{
          label: t("noServer.calCom.action"),
          onPress: () => {
            Linking.openURL(CAL_COM_APP_URL).catch(() => undefined);
          },
        }}
      />
      <InfoCard title={t("noServer.team.title")} body={t("noServer.team.body")} />
      <InfoCard
        title={t("noServer.ownServer.title")}
        body={t("noServer.ownServer.body")}
        action={{ label: t("noServer.ownServer.action"), onPress: () => router.push("/server-guide") }}
      />
      <Button variant="secondary" label={t("bookingActions.goBack")} onPress={close} />
    </FormScreen>
  );
}
