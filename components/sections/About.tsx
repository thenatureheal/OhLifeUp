"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

const KAKAO_URL = "https://open.kakao.com/o/sX6Ip2ri";

export default function About() {
  const { t } = useTranslation();

  return (
    <section id="about" className="bg-bg-alt py-12 lg:py-16">
      <div className="wrap grid gap-4 lg:grid-cols-2">
        {/* Card 1: what is BGI analysis -> product detail landing page */}
        <Link
          href="/product"
          className="card card-hover animate-fade-up group block"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#fdf3da] text-xl">
            🧬
          </div>
          <h3 className="h3 mt-4 flex items-center gap-2">
            {t("about.card1Title")}
            <span className="badge badge-gold text-[0.6rem]">
              {t("about.card1Cta")}
            </span>
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {t("about.card1Desc")}
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent transition-transform group-hover:translate-x-1">
            {t("about.card1Cta")}
            <span aria-hidden="true">→</span>
          </span>
        </Link>

        {/* Card 2: 1:1 inquiry (Kakao) */}
        <a
          href={KAKAO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="card card-hover animate-fade-up block"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#eef0fe] text-xl">
            💬
          </div>
          <h3 className="h3 mt-4 flex items-center gap-2">
            {t("about.card2Title")}
            <span className="badge badge-gold text-[0.6rem]">
              {t("about.card2Cta")}
            </span>
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {t("about.card2Desc")}
          </p>
        </a>
      </div>
    </section>
  );
}
