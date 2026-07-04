"use client";

import { useEffect, useState } from "react";
import {
  listInquiries,
  replyToInquiry,
  type Inquiry,
} from "@/lib/inquiries";
import { fmtDate } from "@/lib/format";

export default function AdminInquiriesPage() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "new" | "answered">("all");

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listInquiries());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const open = (inq: Inquiry) => {
    if (openId === inq.id) {
      setOpenId(null);
      return;
    }
    setOpenId(inq.id);
    setReplyText(inq.reply ?? "");
  };

  const submitReply = async (id: string) => {
    if (!replyText.trim()) {
      alert("답변 내용을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await replyToInquiry(id, replyText);
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                reply: replyText.trim(),
                status: "answered",
                repliedAt: new Date().toISOString(),
              }
            : r
        )
      );
      setOpenId(null);
    } catch (e) {
      console.error(e);
      alert("답변 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const visible = rows.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="h2">문의 관리</h1>
          <p className="mt-2 text-sm text-text-muted">
            고객 문의를 확인하고 답변을 작성하세요.
          </p>
        </div>
        <button
          onClick={load}
          className="btn btn-outline !min-h-0 !py-2 text-xs"
        >
          새로고침
        </button>
      </div>

      {/* Filter */}
      <div className="mt-4 flex gap-1">
        {(
          [
            { k: "all", label: "전체" },
            { k: "new", label: "미답변" },
            { k: "answered", label: "답변완료" },
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
        <p className="mt-8 text-text-muted">문의가 없습니다.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {visible.map((inq) => {
            const isOpen = openId === inq.id;
            return (
              <li key={inq.id} className="card !p-0 overflow-hidden">
                <button
                  onClick={() => open(inq)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-bg-alt"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`badge ${
                          inq.status === "answered"
                            ? "badge-green"
                            : "badge-gold"
                        }`}
                      >
                        {inq.status === "answered" ? "답변완료" : "미답변"}
                      </span>
                      <span className="font-bold text-text-primary">
                        {inq.name}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-text-secondary">
                      {inq.message}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-text-muted">
                    {fmtDate(inq.createdAt)}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-border bg-bg-alt p-5">
                    {/* Contact info */}
                    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                      {inq.phone && <span>📞 {inq.phone}</span>}
                      {inq.email && <span>✉️ {inq.email}</span>}
                    </div>

                    {/* Original message */}
                    <div className="rounded border border-border bg-bg p-4 text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
                      {inq.message}
                    </div>

                    {/* Previous reply (if answered) */}
                    {inq.status === "answered" && inq.reply && (
                      <div className="mt-3 rounded border border-[#b5e0c8] bg-[#e8f7ef] p-4 text-sm text-[#1a8a52]">
                        <p className="mb-1 text-xs font-bold">
                          기존 답변 · {fmtDate(inq.repliedAt)}
                        </p>
                        <p className="whitespace-pre-wrap">{inq.reply}</p>
                      </div>
                    )}

                    {/* Reply editor */}
                    <div className="field mt-4">
                      <label>답변 작성</label>
                      <textarea
                        className="textarea !min-h-[120px]"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="고객에게 보낼 답변을 작성하세요."
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => submitReply(inq.id)}
                        className="btn btn-gold !min-h-0 !py-2 text-xs"
                        disabled={saving}
                      >
                        {saving
                          ? "저장 중..."
                          : inq.status === "answered"
                            ? "답변 수정"
                            : "답변 등록"}
                      </button>
                      <button
                        onClick={() => setOpenId(null)}
                        className="btn btn-outline !min-h-0 !py-2 text-xs"
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
