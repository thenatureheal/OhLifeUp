"use client";

import { useTranslation } from "react-i18next";

/**
 * Social-proof ticker: recent PayPal applicants sliding continuously upward.
 * Names/contacts are masked for privacy. The data is a curated sample list
 * (the public payment page can't read the admin-only `payments` collection),
 * so it stays static — no Date/random at render → no hydration mismatch.
 */

type Applicant = {
  name: string; // full name → masked at render
  tail: string; // last 4 phone digits
  region: string;
  product: "bulk" | "allinone";
  min: number; // minutes ago
};

// Ordered most-recent first.
const APPLICANTS: Applicant[] = [
  { name: "김민수", tail: "3271", region: "서울", product: "bulk", min: 0 },
  { name: "이서연", tail: "8842", region: "경기", product: "allinone", min: 2 },
  { name: "박준호", tail: "1195", region: "부산", product: "bulk", min: 7 },
  { name: "최지우", tail: "6720", region: "인천", product: "allinone", min: 14 },
  { name: "정하늘", tail: "3048", region: "대구", product: "bulk", min: 26 },
  { name: "강예린", tail: "9513", region: "광주", product: "allinone", min: 41 },
  { name: "윤도현", tail: "2267", region: "대전", product: "bulk", min: 58 },
  { name: "임수아", tail: "7734", region: "울산", product: "allinone", min: 82 },
  { name: "한지훈", tail: "4409", region: "제주", product: "bulk", min: 121 },
  { name: "오세영", tail: "5586", region: "세종", product: "allinone", min: 176 },
];

/** 김민수 → 김*수 · 남궁민수 → 남**수 */
function maskName(name: string): string {
  if (name.length <= 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

export default function RecentApplicants() {
  const { t } = useTranslation();

  const timeAgo = (min: number) => {
    if (min < 1) return t("payment.recentJustNow");
    if (min < 60) return t("payment.recentMinAgo", { n: min });
    return t("payment.recentHourAgo", { n: Math.floor(min / 60) });
  };

  const productName = (p: Applicant["product"]) =>
    p === "bulk" ? t("payment.recentProductBulk") : t("payment.recentProductAllinone");

  // Duplicate the list so the -50% upward translate loops seamlessly.
  const loop = [...APPLICANTS, ...APPLICANTS];

  return (
    <div className="card mt-8 overflow-hidden">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1a8a52] opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1a8a52]" />
        </span>
        <h3 className="text-base font-bold text-text-primary">
          {t("payment.recentTitle")}
        </h3>
      </div>
      <p className="mt-1 text-xs text-text-muted">{t("payment.recentNote")}</p>

      {/* Viewport: exactly 3 rows tall, fade top & bottom */}
      <div
        className="relative mt-4 h-[168px] overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)",
        }}
      >
        <ul className="animate-marquee-up [animation-play-state:running] hover:[animation-play-state:paused]">
          {loop.map((a, i) => (
            <li
              key={i}
              className="flex h-14 items-center gap-3 border-b border-border/70"
            >
              {/* Avatar initial */}
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#fdf6e3] text-sm font-bold text-accent">
                {a.name[0]}
              </span>

              {/* Name + contact/region */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-text-primary">
                  {maskName(a.name)}
                  <span className="ml-1.5 font-normal text-text-muted">
                    ({a.region})
                  </span>
                </p>
                <p className="truncate text-xs text-text-muted">
                  010-****-{a.tail} · {productName(a.product)}
                </p>
              </div>

              {/* Status + time */}
              <div className="flex flex-none flex-col items-end gap-1">
                <span className="badge badge-green !px-2 !py-0.5 text-[0.65rem]">
                  {t("payment.statusPaid")}
                </span>
                <span className="text-[0.65rem] text-text-muted">
                  {timeAgo(a.min)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
