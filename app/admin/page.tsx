"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAllPayments, type PaymentRecord } from "@/lib/payments";
import { listInquiries, type Inquiry } from "@/lib/inquiries";
import {
  listNotifications,
  type AppNotification,
} from "@/lib/notifications";
import { fmtDate } from "@/lib/format";

const TYPE_ICON: Record<string, string> = {
  payment: "💳",
  refund: "↩️",
  cancel: "⛔",
  inquiry: "✉️",
};

export default function AdminDashboard() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, i, n] = await Promise.all([
          listAllPayments(),
          listInquiries(),
          listNotifications(),
        ]);
        setPayments(p);
        setInquiries(i);
        setNotifications(n);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const paid = payments.filter((p) => p.status === "paid").length;
  const refunded = payments.filter((p) => p.status === "refunded").length;
  const cancelled = payments.filter((p) => p.status === "cancelled").length;
  const newInquiries = inquiries.filter((i) => i.status === "new").length;

  const stats = [
    { label: "총 결제", value: payments.length, href: "/admin/payments" },
    { label: "결제 완료", value: paid, href: "/admin/payments" },
    { label: "환불", value: refunded, href: "/admin/payments" },
    { label: "취소", value: cancelled, href: "/admin/payments" },
    { label: "미답변 문의", value: newInquiries, href: "/admin/inquiries" },
  ];

  return (
    <div>
      <h1 className="h2">대시보드</h1>
      <p className="mt-2 text-sm text-text-muted">
        결제·문의 현황을 한눈에 확인하세요.
      </p>

      {loading ? (
        <p className="mt-8 text-text-muted">불러오는 중...</p>
      ) : (
        <>
          {/* Stat cards */}
          <div className="mt-6 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
            {stats.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="card card-hover !p-4"
              >
                <p className="text-xs font-bold text-text-muted">{s.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-text-primary">
                  {s.value}
                </p>
              </Link>
            ))}
          </div>

          {/* Recent notifications */}
          <div className="card mt-6">
            <div className="flex items-center justify-between">
              <h2 className="h3">최근 알림</h2>
              <Link
                href="/admin/notifications"
                className="text-sm text-accent hover:underline"
              >
                전체 보기
              </Link>
            </div>
            {notifications.length === 0 ? (
              <p className="mt-4 text-sm text-text-muted">알림이 없습니다.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {notifications.slice(0, 6).map((n) => (
                  <li
                    key={n.id}
                    className="flex items-start gap-3 py-3 text-sm"
                  >
                    <span className="text-lg">
                      {TYPE_ICON[n.type] ?? "•"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text-primary">
                        {!n.read && (
                          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-accent align-middle" />
                        )}
                        {n.title}
                      </p>
                      <p className="mt-0.5 truncate text-text-muted">
                        {n.message}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-text-muted">
                      {fmtDate(n.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
