import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";

export const resources = {
  en: { translation: en },
} as const;

export const defaultLanguage = "en";

export function pickLanguage(deviceLanguageCodes: readonly (string | null)[]): string {
  const supported = Object.keys(resources);
  return deviceLanguageCodes.find((code) => code !== null && supported.includes(code)) ?? defaultLanguage;
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: pickLanguage(getLocales().map((locale) => locale.languageCode)),
    fallbackLng: defaultLanguage,
    // Resources are bundled, so initialise synchronously and avoid a first render without strings.
    initAsync: false,
    // React already escapes rendered text.
    interpolation: { escapeValue: false },
  });
}

export default i18n;
