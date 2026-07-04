"use client";

import { useEffect, useState } from "react";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  normalizeAmount,
  type Product,
  type ProductInput,
} from "@/lib/products";

const EMPTY_FORM: ProductInput = {
  name: "",
  description: "",
  amount: "",
  currency: "USD",
  active: true,
  sortOrder: 0,
};

export default function AdminProductsPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null); // null=none, "new"=create
  const [form, setForm] = useState<ProductInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listProducts());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setField = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => {
    setError("");
    setForm({ ...EMPTY_FORM, sortOrder: rows.length });
    setEditingId("new");
  };

  const openEdit = (p: Product) => {
    setError("");
    setForm({
      name: p.name,
      description: p.description,
      amount: p.amount,
      currency: p.currency,
      active: p.active,
      sortOrder: p.sortOrder,
    });
    setEditingId(p.id);
  };

  const save = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("상품명을 입력해주세요.");
      return;
    }
    const amount = normalizeAmount(form.amount);
    if (!amount) {
      setError("결제 금액을 올바르게 입력해주세요. (예: 122.00)");
      return;
    }
    setSaving(true);
    try {
      const payload: ProductInput = { ...form, amount };
      if (editingId === "new") {
        await createProduct(payload);
      } else if (editingId) {
        await updateProduct(editingId, payload);
      }
      setEditingId(null);
      await load();
    } catch (e) {
      console.error(e);
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Product) => {
    try {
      await updateProduct(p.id, {
        name: p.name,
        description: p.description,
        amount: p.amount,
        currency: p.currency,
        active: !p.active,
        sortOrder: p.sortOrder,
      });
      setRows((prev) =>
        prev.map((r) => (r.id === p.id ? { ...r, active: !r.active } : r))
      );
    } catch (e) {
      console.error(e);
      alert("상태 변경 중 오류가 발생했습니다.");
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`"${p.name}" 상품을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      await deleteProduct(p.id);
      setRows((prev) => prev.filter((r) => r.id !== p.id));
    } catch (e) {
      console.error(e);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="h2">상품 관리</h1>
          <p className="mt-2 text-sm text-text-muted">
            PayPal 결제 상품과 금액을 등록·수정합니다. 실제 청구 금액은 서버가 이
            값으로 처리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="btn btn-outline !min-h-0 !py-2 text-xs"
          >
            새로고침
          </button>
          <button
            onClick={openNew}
            className="btn btn-gold !min-h-0 !py-2 text-xs"
          >
            + 상품 등록
          </button>
        </div>
      </div>

      {/* Editor */}
      {editingId && (
        <div className="card mt-6">
          <h2 className="h3">
            {editingId === "new" ? "새 상품 등록" : "상품 수정"}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="field sm:col-span-2">
              <label>
                상품명 <span className="text-accent">*</span>
              </label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="예: BGI 대량유전자분석 패키지"
              />
            </div>
            <div className="field sm:col-span-2">
              <label>상품 설명</label>
              <input
                className="input"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="상품에 대한 짧은 설명"
              />
            </div>
            <div className="field">
              <label>
                결제 금액 <span className="text-accent">*</span>
              </label>
              <input
                className="input"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setField("amount", e.target.value)}
                placeholder="122.00"
              />
            </div>
            <div className="field">
              <label>통화</label>
              <select
                aria-label="통화"
                className="select"
                value={form.currency}
                onChange={(e) => setField("currency", e.target.value)}
              >
                <option value="USD">USD ($)</option>
                <option value="KRW">KRW (₩)</option>
                <option value="EUR">EUR (€)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="CNY">CNY (¥)</option>
                <option value="HKD">HKD ($)</option>
              </select>
            </div>
            <div className="field">
              <label>정렬 순서 (작을수록 위)</label>
              <input
                className="input"
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setField("sortOrder", Number(e.target.value) || 0)
                }
              />
            </div>
            <div className="field">
              <label>노출 여부</label>
              <label className="mt-1 inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setField("active", e.target.checked)}
                />
                결제 페이지에 노출
              </label>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button
              onClick={save}
              className="btn btn-gold !min-h-0 !py-2 text-xs"
              disabled={saving}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="btn btn-outline !min-h-0 !py-2 text-xs"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="mt-8 text-text-muted">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <div className="card mt-6 text-center text-sm text-text-muted">
          등록된 상품이 없습니다. 오른쪽 위 &quot;+ 상품 등록&quot;으로
          추가하세요.
        </div>
      ) : (
        <div className="card mt-6 overflow-x-auto !p-0">
          <table className="board-table min-w-[720px]">
            <thead>
              <tr>
                <th>순서</th>
                <th>상품명</th>
                <th>설명</th>
                <th>금액</th>
                <th>노출</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="td-center">{p.sortOrder}</td>
                  <td className="td-title">{p.name}</td>
                  <td className="max-w-[220px] truncate" title={p.description}>
                    {p.description || "-"}
                  </td>
                  <td className="whitespace-nowrap font-bold">
                    {p.amount} {p.currency}
                  </td>
                  <td>
                    <button
                      onClick={() => toggleActive(p)}
                      className={`badge ${
                        p.active ? "badge-green" : "badge-gold"
                      }`}
                    >
                      {p.active ? "노출중" : "숨김"}
                    </button>
                  </td>
                  <td>
                    <div className="flex gap-2 whitespace-nowrap">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-xs font-bold text-accent hover:underline"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => remove(p)}
                        className="text-xs font-bold text-red-500 hover:underline"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
