"use client";

import { useEffect, useState } from "react";
import {
  listAllPayments,
  listAllPaymentDetails,
  updateShipping,
  EMPTY_DETAILS,
  type PaymentRecord,
  type PaymentDetails,
  type ShippingStatus,
} from "@/lib/payments";
import { fmtDate } from "@/lib/format";

const SHIPPING_META: Record<ShippingStatus, { label: string; badge: string }> =
  {
    preparing: { label: "배송준비중", badge: "badge-gold" },
    shipping: { label: "배송중", badge: "badge-blue" },
    delivered: { label: "배송완료", badge: "badge-green" },
  };

const STATUS_ORDER: ShippingStatus[] = ["preparing", "shipping", "delivered"];

export default function AdminShippingPage() {
  const [rows, setRows] = useState<PaymentRecord[]>([]);
  const [details, setDetails] = useState<Record<string, PaymentDetails>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ShippingStatus>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ courier: "", trackingNo: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, d] = await Promise.all([
        listAllPayments(),
        listAllPaymentDetails(),
      ]);
      // 배송 대상은 결제완료(paid) 건만.
      setRows(p.filter((r) => r.status === "paid"));
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

  const openEditor = (r: PaymentRecord) => {
    setEditing(r.id);
    setDraft({ courier: r.courier, trackingNo: r.trackingNo });
  };

  const applyShipping = async (r: PaymentRecord, status: ShippingStatus) => {
    setBusy(r.id);
    try {
      const courier = editing === r.id ? draft.courier : r.courier;
      const trackingNo = editing === r.id ? draft.trackingNo : r.trackingNo;
      await updateShipping(r.id, { shippingStatus: status, courier, trackingNo });
      setRows((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? { ...x, shippingStatus: status, courier, trackingNo }
            : x
        )
      );
    } catch (e) {
      console.error(e);
      alert("배송 정보 저장 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const fullAddress = (id: string) => {
    const d = details[id] ?? EMPTY_DETAILS;
    const parts = [
      d.postcode ? `(${d.postcode})` : "",
      d.address,
      d.addressDetail,
    ].filter(Boolean);
    return parts.join(" ");
  };

  const visible =
    filter === "all" ? rows : rows.filter((r) => r.shippingStatus === filter);
  const counts = {
    all: rows.length,
    preparing: rows.filter((r) => r.shippingStatus === "preparing").length,
    shipping: rows.filter((r) => r.shippingStatus === "shipping").length,
    delivered: rows.filter((r) => r.shippingStatus === "delivered").length,
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="h2">배송 관리</h1>
          <p className="mt-2 text-sm text-text-muted">
            결제완료 주문의 배송 상태를 관리합니다. 택배사·송장번호를 입력하고
            배송준비중 → 배송중 → 배송완료로 변경하세요. 구매자는 “내 결제
            조회”에서 배송 상태를 확인합니다.
          </p>
        </div>
        <button onClick={load} className="btn btn-outline !min-h-0 !py-2 text-xs">
          새로고침
        </button>
      </div>

      {/* Shipping status filter */}
      {rows.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {(
            [
              { k: "all", label: `전체 (${counts.all})` },
              { k: "preparing", label: `배송준비중 (${counts.preparing})` },
              { k: "shipping", label: `배송중 (${counts.shipping})` },
              { k: "delivered", label: `배송완료 (${counts.delivered})` },
            ] as const
          ).map((f) => (
            <button
              key={f.k}
              type="button"
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
      )}

      {loading ? (
        <p className="mt-8 text-text-muted">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-text-muted">배송할 주문이 없습니다.</p>
      ) : (
        <div className="card mt-6 overflow-x-auto !p-0">
          <table className="board-table min-w-[980px]">
            <thead>
              <tr>
                <th>이름</th>
                <th>전화번호</th>
                <th>상품</th>
                <th>수량</th>
                <th>받는분</th>
                <th>배송지 주소</th>
                <th>택배사</th>
                <th>송장번호</th>
                <th>배송 상태</th>
                <th>결제일</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const isOpen = editing === r.id;
                return (
                  <tr key={r.id} className="align-top">
                    <td className="td-title">{r.name}</td>
                    <td>{r.phone}</td>
                    <td className="max-w-[160px] truncate" title={r.packageName}>
                      {r.packageName}
                    </td>
                    <td>{r.quantity}</td>
                    <td>{(details[r.id] ?? EMPTY_DETAILS).recipient || "-"}</td>
                    <td
                      className="max-w-[220px] truncate"
                      title={fullAddress(r.id)}
                    >
                      {fullAddress(r.id) || (
                        <span className="text-red-500">주소 없음</span>
                      )}
                    </td>
                    <td>{r.courier || "-"}</td>
                    <td className="font-mono text-xs">{r.trackingNo || "-"}</td>
                    <td>
                      <span
                        className={`badge ${SHIPPING_META[r.shippingStatus].badge}`}
                      >
                        {SHIPPING_META[r.shippingStatus].label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td>
                      <button
                        onClick={() =>
                          isOpen ? setEditing(null) : openEditor(r)
                        }
                        className="text-xs font-bold text-accent hover:underline"
                      >
                        {isOpen ? "닫기" : "배송정보 입력"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Editor panel */}
          {editing &&
            (() => {
              const r = rows.find((x) => x.id === editing);
              if (!r) return null;
              return (
                <div className="border-t border-border bg-bg-alt p-5">
                  <p className="mb-1 text-sm font-bold text-text-primary">
                    🚚 {r.name} · {r.packageName}
                  </p>
                  {(() => {
                    const d = details[r.id] ?? EMPTY_DETAILS;
                    return (
                      <p className="mb-4 text-xs text-text-muted">
                        받는분: {d.recipient || r.name} · 배송지:{" "}
                        {fullAddress(r.id) || "주소 없음"} · 연락처: {r.phone}
                        {d.tel ? ` · 일반전화: ${d.tel}` : ""}
                        {d.deliveryMessage
                          ? ` · 배송메시지: ${d.deliveryMessage}`
                          : ""}
                        {` · 수량: ${r.quantity}`}
                      </p>
                    );
                  })()}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="field">
                      <label>택배사</label>
                      <input
                        className="input"
                        value={draft.courier}
                        onChange={(e) =>
                          setDraft((f) => ({ ...f, courier: e.target.value }))
                        }
                        placeholder="예: CJ대한통운, 우체국택배"
                      />
                    </div>
                    <div className="field">
                      <label>송장번호</label>
                      <input
                        className="input"
                        value={draft.trackingNo}
                        onChange={(e) =>
                          setDraft((f) => ({ ...f, trackingNo: e.target.value }))
                        }
                        placeholder="송장번호를 입력하세요"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => applyShipping(r, r.shippingStatus)}
                      className="btn btn-gold !min-h-0 !py-2 text-xs"
                      disabled={busy === r.id}
                    >
                      {busy === r.id ? "저장 중..." : "배송정보 저장"}
                    </button>

                    <span className="mx-2 h-5 w-px bg-border" />
                    <span className="text-xs text-text-muted">배송 상태:</span>
                    {STATUS_ORDER.map((s) => (
                      <button
                        key={s}
                        onClick={() => applyShipping(r, s)}
                        disabled={busy === r.id || r.shippingStatus === s}
                        className={`rounded border px-3 py-1.5 text-xs font-bold transition-colors ${
                          r.shippingStatus === s
                            ? "border-accent bg-accent text-white"
                            : "border-border text-text-secondary hover:border-accent hover:text-accent"
                        }`}
                      >
                        {SHIPPING_META[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
        </div>
      )}
    </div>
  );
}
