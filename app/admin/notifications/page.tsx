"use client";

import { useEffect, useState } from "react";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
  type NotificationType,
} from "@/lib/notifications";
import { fmtDate } from "@/lib/format";

const TYPE_META: Record<
  NotificationType,
  { label: string; icon: string; badge: string }
> = {
  payment: { label: "결제", icon: "💳", badge: "badge-green" },
  refund: { label: "환불", icon: "↩️", badge: "badge-blue" },
  cancel: { label: "취소", icon: "⛔", badge: "badge-gold" },
  inquiry: { label: "문의", icon: "✉️", badge: "badge-gold" },
  refund_request: { label: "환불신청", icon: "🙋", badge: "badge-blue" },
};

export default function AdminNotificationsPage() {
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | NotificationType>("all");

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listNotifications());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markOne = async (id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, read: true } : r))
    );
    try {
      await markNotificationRead(id);
    } catch (e) {
      console.error(e);
    }
  };

  const markAll = async () => {
    setRows((prev) => prev.map((r) => ({ ...r, read: true })));
    try {
      await markAllNotificationsRead();
    } catch (e) {
      console.error(e);
    }
  };

  const visible = rows.filter((r) =>
    filter === "all" ? true : r.type === filter
  );
  const unread = rows.filter((r) => !r.read).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="h2">알림</h1>
          <p className="mt-2 text-sm text-text-muted">
            결제·환불·취소·문의 기록입니다. (미읽음 {unread})
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={markAll}
            className="btn btn-outline !min-h-0 !py-2 text-xs"
            disabled={unread === 0}
          >
            모두 읽음
          </button>
          <button
            onClick={load}
            className="btn btn-outline !min-h-0 !py-2 text-xs"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="mt-4 flex flex-wrap gap-1">
        {(
          [
            { k: "all", label: "전체" },
            { k: "payment", label: "결제" },
            { k: "refund_request", label: "환불신청" },
            { k: "refund", label: "환불" },
            { k: "cancel", label: "취소" },
            { k: "inquiry", label: "문의" },
          ] as const
        ).map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            className={`rounded px-3 py-1.5 text-xs font-bold transition-colors ${
              filter === f.k
                ? "bg-accent text-white"
                : "text-text-secondary hover:bg-bg-alt"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-text-muted">불러오는 중...</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-text-muted">알림이 없습니다.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {visible.map((n) => {
            const meta = TYPE_META[n.type];
            return (
              <li
                key={n.id}
                className={`card flex items-start gap-3 !p-4 ${
                  n.read ? "opacity-70" : ""
                }`}
              >
                <span className="text-xl">{meta?.icon ?? "•"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${meta?.badge ?? ""}`}>
                      {meta?.label ?? n.type}
                    </span>
                    {!n.read && (
                      <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                    )}
                  </div>
                  <p className="mt-1 font-semibold text-text-primary">
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {n.message}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="whitespace-nowrap text-xs text-text-muted">
                    {fmtDate(n.createdAt)}
                  </span>
                  {!n.read && (
                    <button
                      onClick={() => markOne(n.id)}
                      className="text-xs text-accent hover:underline"
                    >
                      읽음
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
