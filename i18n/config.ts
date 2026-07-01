import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ko from "./ko";
import en from "./en";
import zh from "./zh";

export const LANGS = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "EN" },
  { code: "zh", label: "中文" },
] as const;

export const STORAGE_KEY = "ohlifeup.lang";

// NOTE: We deliberately init with a fixed `lng: 'ko'` (no auto language
// detection) so the server-rendered HTML and the client's first paint match
// (avoids React hydration mismatches). A saved preference in localStorage is
// applied after mount in <Providers/>, and the language switcher persists it.
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
      zh: { translation: zh },
    },
    lng: "ko",
    fallbackLng: "ko",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
