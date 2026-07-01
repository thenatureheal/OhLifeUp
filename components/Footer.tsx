"use client";

import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-[#0a0a0f] text-white">
      <div className="wrap grid gap-8 py-12 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        {/* Brand */}
        <div>
          <div className="mb-3 text-xl font-extrabold">
            Oh<span className="text-accent">LifeUp</span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-[#8f8fa5]">
            {t("footer.tagline")}
          </p>
        </div>

        {/* Contact */}
        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-accent">
            {t("footer.contact")}
          </h3>
          <ul className="space-y-2 text-sm text-[#8f8fa5]">
            <li>010-6407-0988</li>
            <li>thenatureheal@gmail.com</li>
            <li>{t("footer.hours")}</li>
          </ul>
        </div>

        {/* Hubs */}
        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-accent">
            {t("footer.hubs")}
          </h3>
          <ul className="space-y-2 text-sm text-[#8f8fa5]">
            <li>{t("footer.hubWeihai")}</li>
            <li>{t("footer.hubGuangzhou")}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="wrap py-4 text-xs text-[#4a4a5a]">
          © 2026 OhLifeUp. {t("footer.rights")}
        </div>
      </div>
    </footer>
  );
}
