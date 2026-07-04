"use client";

import { useEffect, useState } from "react";
import {
  listAllPayments,
  listAllPaymentDetails,
  savePaymentDetails,
  updatePaymentStatus,
  EMPTY_DETAILS,
  type PaymentRecord,
  type PaymentDetails,
  type PaymentStatus,
} from "@/lib/payments";
import { createNotification } from "@/lib/notifications";
import { fmtDate } from "@/lib/format";

const STATUS_META: Record<
  PaymentStatus,
  { label: string; badge: string }
> = {
  paid: { label: "결제완료", badge: "badge-green" },
  refunded: { label: "환불", badge: "badge-blue" },
  cancelled: { label: "취소", badge: "badge-gold" },
};

const GENDER_LABEL: Record<string, string> = {
  male: "남",
  female: "여",
  other: "기타",
  "": "-",
};

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<PaymentRecord[]>([]);
  const [details, setDetails] = useState<Record<string, PaymentDetails>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<PaymentDetails>(EMPTY_DETAILS);
  const [saving, setSaving] = useState(false);
  const [busyStatus, setBusyStatus] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, d] = await Promise.all([
        listAllPayments(),
        listAllPaymentDetails(),
      ]);
      setRows(p);
      setDetails(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openEditor = (id: string) => {
    setEditing(id);
    setDraft(details[id] ?? { ...EMPTY_DETAILS });
  };

  const saveDetails = async (id: string) => {
    setSaving(true);
    try {
      await savePaymentDetails(id, draft);
      setDetails((prev) => ({ ...prev, [id]: draft }));
      setEditing(null);
    } catch (e) {
      console.error(e);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (row: PaymentRecord, status: PaymentStatus) => {
    if (row.status === status) return;
    setBusyStatus(row.id);
    try {
      await updatePaymentStatus(row.id, status);
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status } : r))
      );
      if (status === "refunded" || status === "cancelled") {
        const kind = status === "refunded" ? "환불" : "취소";
        const notifyType = status === "refunded" ? "refund" : "cancel";
        await createNotification(
          notifyType,
          `${kind} 처리: ${row.name}`,
          `${row.packageName} · $${row.amount} ${row.currency} (주문 ${row.orderId})`,
          row.id
        );
      }
    } catch (e) {
      console.error(e);
      alert("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setBusyStatus(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="h2">결제 목록</h1>
          <p className="mt-2 text-sm text-text-muted">
            결제자 정보와 상태를 관리합니다. 주소·생년월일·성별은 직접 입력하세요.
          </p>
        </div>
        <button
          onClick={load}
          className="btn btn-outline !min-h-0 !py-2 text-xs"
        >
          새로고침
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-text-muted">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-text-muted">결제 내역이 없습니다.</p>
      ) : (
        <div className="card mt-6 overflow-x-auto !p-0">
          <table className="board-table min-w-[860px]">
            <thead>
              <tr>
                <th>이름</th>
                <th>전화번호</th>
                <th>이메일</th>
                <th>생년월일</th>
                <th>성별</th>
                <th>주소</th>
                <th>결제</th>
                <th>상태</th>
                <th>결제일</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = details[r.id] ?? EMPTY_DETAILS;
                const isOpen = editing === r.id;
                return (
                  <tr key={r.id} className="align-top">
                    <td className="td-title">{r.name}</td>
                    <td>{r.phone}</td>
                    <td className="max-w-[160px] truncate">{r.email || "-"}</td>
                    <td>{d.birthdate || "-"}</td>
                    <td>{GENDER_LABEL[d.gender] ?? d.gender}</td>
                    <td className="max-w-[200px] truncate" title={d.address}>
                      {d.address || "-"}
                    </td>
                    <td className="whitespace-nowrap">
                      ${r.amount} {r.currency}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_META[r.status].badge}`}>
                        {STATUS_META[r.status].label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td>
                      <button
                        onClick={() =>
                          isOpen ? setEditing(null) : openEditor(r.id)
                        }
                        className="text-xs font-bold text-accent hover:underline"
                      >
                        {isOpen ? "닫기" : "편집"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Editor panel (below table, for the selected row) */}
          {editing &&
            (() => {
              const r = rows.find((x) => x.id === editing);
              if (!r) return null;
              return (
                <div className="border-t border-border bg-bg-alt p-5">
                  <p className="mb-4 text-sm font-bold text-text-primary">
                    ✏️ {r.name} · 주문 {r.orderId}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="field">
                      <label>생년월일</label>
                      <input
                        className="input"
                        value={draft.birthdate}
                        onChange={(e) =>
                          setDraft((f) => ({ ...f, birthdate: e.target.value }))
                        }
                        placeholder="1990-01-01"
                      />
                    </div>
                    <div className="field">
                      <label>성별</label>
                      <select
                        aria-label="성별"
                        className="select"
                        value={draft.gender}
                        onChange={(e) =>
                          setDraft((f) => ({ ...f, gender: e.target.value }))
                        }
                      >
                        <option value="">선택 안함</option>
                        <option value="male">남</option>
                        <option value="female">여</option>
                        <option value="other">기타</option>
                      </select>
                    </div>
                    <div className="field sm:col-span-2">
                      <label>주소</label>
                      <input
                        className="input"
                        value={draft.address}
                        onChange={(e) =>
                          setDraft((f) => ({ ...f, address: e.target.value }))
                        }
                        placeholder="주소를 입력하세요"
                      />
                    </div>
                    <div className="field sm:col-span-2">
                      <label>메모</label>
                      <input
                        className="input"
                        value={draft.memo}
                        onChange={(e) =>
                          setDraft((f) => ({ ...f, memo: e.target.value }))
                        }
                        placeholder="관리자 메모 (선택)"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => saveDetails(r.id)}
                      className="btn btn-gold !min-h-0 !py-2 text-xs"
                      disabled={saving}
                    >
                      {saving ? "저장 중..." : "정보 저장"}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="btn btn-outline !min-h-0 !py-2 text-xs"
                    >
                      취소
                    </button>

                    <span className="mx-2 h-5 w-px bg-border" />
                    <span className="text-xs text-text-muted">상태 변경:</span>
                    {(["paid", "refunded", "cancelled"] as PaymentStatus[]).map(
                      (s) => (
                        <button
                          key={s}
                          onClick={() => changeStatus(r, s)}
                          disabled={busyStatus === r.id || r.status === s}
                          className={`rounded border px-3 py-1.5 text-xs font-bold transition-colors ${
                            r.status === s
                              ? "border-accent bg-accent text-white"
                              : "border-border text-text-secondary hover:border-accent hover:text-accent"
                          }`}
                        >
                          {STATUS_META[s].label}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })()}
        </div>
      )}
    </div>
  );
}
