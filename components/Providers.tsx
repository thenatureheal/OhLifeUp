"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { STORAGE_KEY } from "@/i18n/config";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Apply a saved language preference after mount. Doing this in an effect
  // (rather than at init) keeps the server render and first client render on
  // the default 'ko', avoiding hydration mismatches.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved !== i18n.language) {
        i18n.changeLanguage(saved);
      }
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
