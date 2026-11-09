import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { InfoCard } from "@/components/InfoCard";
import { CAL_DIY_DEPLOYMENT_URL, openInBrowser, SERVER_SETUP_URL } from "@/lib/links";

/**
 * What running your own Cal.diy takes, readable on the phone. The steps that need configuration files link
 * to guides on the web, which are easier to copy from on the computer that does the setup.
 */
export function ServerGuideScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace("/sign-in");
  }

  return (
    <FormScreen title={t("serverGuide.title")} description={t("serverGuide.description")}>
      <InfoCard step={1} title={t("serverGuide.server.title")} body={t("serverGuide.server.body")} />
      <InfoCard
        step={2}
        title={t("serverGuide.install.title")}
        body={t("serverGuide.install.body")}
        action={{
          label: t("serverGuide.install.action"),
          onPress: () => openInBrowser(CAL_DIY_DEPLOYMENT_URL),
        }}
      />
      <InfoCard
        step={3}
        title={t("serverGuide.apiV2.title")}
        body={t("serverGuide.apiV2.body")}
        action={{ label: t("serverGuide.apiV2.action"), onPress: () => openInBrowser(SERVER_SETUP_URL) }}
      />
      <InfoCard step={4} title={t("serverGuide.connect.title")} body={t("serverGuide.connect.body")} />
      <Button variant="secondary" label={t("bookingActions.goBack")} onPress={close} />
    </FormScreen>
  );
}
