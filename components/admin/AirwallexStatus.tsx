"use client";

import { useEffect, useState } from "react";

interface Status {
  configured: boolean;
  env: "demo" | "prod" | null;
  webhookConfigured: boolean;
}

/**
 * Admin-only badge showing whether the Airwallex payment integration is live.
 * Fetches /api/airwallex/status (booleans only — no secrets). Shown on the
 * dashboard and the product-management page.
 */
export default function AirwallexStatus({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/airwallex/status")
      .then((r) => r.json())
      .then((d: Status) => setStatus(d))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  const connected = Boolean(status?.configured);
  const isProd = status?.env === "prod";

  // (dot color, label, sub-note)
  const tone = loading
    ? { dot: "bg-gray-300", text: "text-text-muted", label: "결제 연동 상태 확인 중…" }
    : !connected
      ? { dot: "bg-red-500", text: "text-red-600", label: "Airwallex 미연결" }
      : isProd
        ? { dot: "bg-green-500", text: "text-[#1a8a52]", label: "Airwallex 연결됨 · 운영(prod)" }
        : { dot: "bg-amber-500", text: "text-amber-600", label: "Airwallex 연결됨 · 테스트(demo)" };

  const subNote = loading
    ? ""
    : !connected
      ? "Vercel 환경변수(AIRWALLEX_*)를 설정하고 재배포하세요."
      : status?.webhookConfigured
        ? "웹훅 연결됨 — 환불·취소 자동 동기화 활성"
        : "웹훅 미설정 — 환불·취소 자동 동기화 비활성";

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-semibold ${tone.text}`}
        title={subNote}
      >
        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
        {tone.label}
      </span>
    );
  }

  return (
    <div className="card !p-4">
      <p className="text-xs font-bold text-text-muted">결제 연동</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
        <span className={`text-sm font-extrabold ${tone.text}`}>{tone.label}</span>
      </div>
      {subNote && <p className="mt-1 text-xs text-text-muted">{subNote}</p>}
    </div>
  );
}
