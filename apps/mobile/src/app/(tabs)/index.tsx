import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function BookingsScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen message={t("placeholder.bookings")} />;
}
