"use client";

import { useTranslation } from "react-i18next";

export default function Hero() {
  const { t } = useTranslation();

  const features = [
    t("hero.feature1"),
    t("hero.feature2"),
    t("hero.feature3"),
    t("hero.feature4"),
  ];

  const scrollToPayment = () => {
    document.getElementById("payment")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-white to-bg-alt">
      {/* Decorative gold blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(201,168,76,0.18), transparent 70%)",
        }}
      />

      <div className="wrap relative grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
        {/* Left: headline + checklist */}
        <div className="animate-fade-up">
          <span className="badge badge-gold mb-6">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            {t("hero.badge")}
          </span>

          <h1 className="h1">
            {t("hero.title1")}
            <br />
            <span className="text-accent">{t("hero.title2")}</span>
          </h1>

          <div className="divider" />

          <ul className="mt-8 space-y-3">
            {features.map((f, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-base text-text-secondary"
              >
                <span className="mt-0.5 font-bold text-accent">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: secure payment info card */}
        <button
          onClick={scrollToPayment}
          className="card card-hover animate-fade-up group text-center lg:p-10"
          aria-label={t("hero.payCardCta")}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl text-white">
            💳
          </div>
          <h2 className="h3 mt-6">{t("hero.payCardTitle")}</h2>
          <p className="mt-2 font-bold text-accent">{t("hero.payCardSubtitle")}</p>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-text-muted">
            {t("hero.payCardDesc")}
          </p>
          <span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-accent transition-transform group-hover:translate-x-1">
            {t("hero.payCardCta")} →
          </span>
        </button>
      </div>
    </section>
  );
}
