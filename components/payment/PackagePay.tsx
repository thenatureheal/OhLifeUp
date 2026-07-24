"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isFirebaseConfigured } from "@/lib/firebase";
import { lookupPayments, type PaymentRecord } from "@/lib/payments";
import { createNotification } from "@/lib/notifications";
import { createRefundRequest } from "@/lib/inquiries";
import { listActiveProducts, type Product } from "@/lib/products";
import { fmtDate } from "@/lib/format";
import RecentApplicants from "./RecentApplicants";

// Representative product thumbnail (products have no image field yet — reuse the
// first detail image from the landing page).
const PRODUCT_THUMB = "/products/allinone/01.png";

// Display fallback price used only when no admin-managed product exists (the
// server controls the real charged amount via AIRWALLEX_AMOUNT). Production has
// products, so this fallback is not normally shown.
const FALLBACK_AMOUNT = "0.00";
const FALLBACK_CURRENCY = "USD";

// Airwallex (Hosted Payment Page). The server holds the real keys; the client
// only needs the env to load airwallex.js. Button shows when the env is set.
const AIRWALLEX_ENV = (process.env.NEXT_PUBLIC_AIRWALLEX_ENV || "") as
  | ""
  | "demo"
  | "prod";
const isAirwallexConfigured = AIRWALLEX_ENV === "demo" || AIRWALLEX_ENV === "prod";
const AIRWALLEX_IS_SANDBOX = AIRWALLEX_ENV !== "prod";

type PayStatus =
  | { kind: "idle" }
  | { kind: "success"; orderId: string }
  | { kind: "cancelled" }
  | { kind: "error" };

type LookupState =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "results"; rows: PaymentRecord[] }
  | { kind: "none" }
  | { kind: "needInfo" };

export default function PackagePay() {
  const { t } = useTranslation();

  // ── Order flow: step 1 = product select (바로구매), step 2 = order sheet ──
  const [step, setStep] = useState<"select" | "order">("select");
  const [quantity, setQuantity] = useState(1);
  const [agree, setAgree] = useState(false);

  // ── Order form (step 2) ──
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    recipient: "",
    postcode: "",
    address: "",
    addressDetail: "",
    tel: "",
    deliveryMessage: "",
  });
  const [payStatus, setPayStatus] = useState<PayStatus>({ kind: "idle" });
  const setField = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // ── Products (admin-managed). Falls back to the legacy env product when the
  //    list is empty or Firebase isn't configured. ──
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    listActiveProducts()
      .then((rows) => {
        setProducts(rows);
        if (rows.length) setSelectedId((cur) => cur || rows[0].id);
      })
      .catch((e) => console.error("load products failed", e));
  }, []);

  const selected = products.find((p) => p.id === selectedId) ?? null;
  const hasProducts = products.length > 0;

  // Effective display/charge values: selected product, else fallback.
  const dispName = selected?.name ?? t("payment.packageName");
  const dispDesc = selected?.description ?? t("payment.packageDesc");
  const dispAmount = selected?.amount ?? FALLBACK_AMOUNT;
  const dispCurrency = selected?.currency ?? FALLBACK_CURRENCY;

  // Quantity only applies when a server-priced product is selected — the env
  // fallback product is always charged as a single unit, so force qty 1 there
  // to keep the displayed total equal to the actual charge.
  const effectiveQty = selected ? quantity : 1;

  // Total = unit × quantity, in integer cents (display only — the server
  // recomputes the real charge from the product doc).
  const totalCents = Math.round(Number(dispAmount) * 100) * effectiveQty;
  const dispTotal = Number.isFinite(totalCents)
    ? (totalCents / 100).toFixed(2)
    : dispAmount;

  const canBuy = !hasProducts || Boolean(selected);
  const canPay =
    canBuy &&
    agree &&
    form.name.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.recipient.trim().length > 0 &&
    form.address.trim().length > 0;

  // ── Airwallex (Hosted Payment Page redirect) ──
  const [awxBusy, setAwxBusy] = useState(false);
  const [awxError, setAwxError] = useState(false);

  const payWithAirwallex = async () => {
    setAwxError(false);
    setAwxBusy(true);
    try {
      // 1) Create the PaymentIntent server-side (amount controlled by server).
      const res = await fetch("/api/airwallex/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          selected
            ? { productId: selected.id, packageName: dispName, quantity: effectiveQty }
            : { packageName: dispName, quantity: effectiveQty }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data.id || !data.clientSecret) {
        throw new Error(data.error || "intent failed");
      }

      // 2) Stash buyer info so the return page can record the payment after the
      //    redirect round-trip (sessionStorage survives the same-tab redirect).
      sessionStorage.setItem(
        "awx_pending",
        JSON.stringify({
          intentId: data.id,
          name: form.name.trim(),
          phone: form.phone,
          email: form.email.trim(),
          recipient: form.recipient.trim(),
          postcode: form.postcode.trim(),
          address: form.address.trim(),
          addressDetail: form.addressDetail.trim(),
          tel: form.tel.trim(),
          deliveryMessage: form.deliveryMessage.trim(),
          quantity: effectiveQty,
          packageName: dispName,
        })
      );

      // 3) Redirect to the Airwallex hosted payment page.
      const { loadAirwallex, redirectToCheckout } = await import(
        "airwallex-payment-elements"
      );
      await loadAirwallex({ env: AIRWALLEX_ENV as "demo" | "prod" });
      const origin = window.location.origin;
      redirectToCheckout({
        env: AIRWALLEX_ENV as "demo" | "prod",
        intent_id: data.id,
        client_secret: data.clientSecret,
        currency: data.currency,
        country_code: "KR",
        successUrl: `${origin}/payment/airwallex/return`,
        failUrl: `${origin}/payment/airwallex/return`,
      });
      // Navigation happens here — no need to reset busy on success.
    } catch (e) {
      console.error(e);
      setAwxError(true);
      setAwxBusy(false);
    }
  };

  // ── Payment lookup ──
  const [lookup, setLookup] = useState({ name: "", phone: "" });
  const [lookupState, setLookupState] = useState<LookupState>({ kind: "idle" });

  // ── Refund / cancel request (customer-initiated) ──
  const [refundOpenId, setRefundOpenId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundErr, setRefundErr] = useState(false);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const submitRefund = async (r: PaymentRecord) => {
    setRefundErr(false);
    setRefundBusy(true);
    try {
      const id = await createRefundRequest({
        name: r.name,
        phone: r.phone,
        email: r.email,
        orderId: r.orderId,
        amount: r.amount,
        currency: r.currency,
        reason: refundReason,
      });
      try {
        await createNotification(
          "refund_request",
          `환불·취소 신청: ${r.name}`,
          `${r.packageName} · ${r.amount} ${r.currency} (주문 ${r.orderId})`,
          id
        );
      } catch (e) {
        console.error("refund notification failed", e);
      }
      setRequestedIds((s) => new Set(s).add(r.id));
      setRefundOpenId(null);
      setRefundReason("");
    } catch (e) {
      console.error(e);
      setRefundErr(true);
    } finally {
      setRefundBusy(false);
    }
  };

  const statusBadge = (status: PaymentRecord["status"]) => {
    const map = {
      paid: { cls: "badge-green", label: t("payment.statusPaid") },
      refunded: { cls: "badge-blue", label: t("payment.statusRefunded") },
      cancelled: { cls: "badge-gold", label: t("payment.statusCancelled") },
    } as const;
    const m = map[status] ?? map.paid;
    return <span className={`badge ${m.cls}`}>{m.label}</span>;
  };

  const shippingBadge = (status: PaymentRecord["shippingStatus"]) => {
    const map = {
      preparing: { cls: "badge-gold", label: t("payment.shippingPreparing") },
      shipping: { cls: "badge-blue", label: t("payment.shippingShipping") },
      delivered: { cls: "badge-green", label: t("payment.shippingDelivered") },
    } as const;
    const m = map[status] ?? map.preparing;
    return <span className={`badge ${m.cls}`}>🚚 {m.label}</span>;
  };

  const runLookup = async () => {
    if (!lookup.name.trim() || !lookup.phone.trim()) {
      setLookupState({ kind: "needInfo" });
      return;
    }
    if (!isFirebaseConfigured) {
      setLookupState({ kind: "none" });
      return;
    }
    setLookupState({ kind: "searching" });
    try {
      const rows = await lookupPayments(lookup.name, lookup.phone);
      setLookupState(rows.length ? { kind: "results", rows } : { kind: "none" });
    } catch (err) {
      console.error(err);
      setLookupState({ kind: "none" });
    }
  };

  return (
    <section id="payment" className="section border-t border-border">
      <div className="wrap">
        {/* Heading */}
        <div className="animate-fade-up text-center">
          <span className="label text-accent">{t("payment.label")}</span>
          <h2 className="h2 mt-2">{t("payment.sectionTitle")}</h2>
          <p className="body-lg mx-auto mt-3 max-w-xl">
            {t("payment.sectionSubtitle")}
          </p>
          <div className="divider mx-auto" />
        </div>

        {/* ── STEP 1: 상품 선택 카드 (옵션 + 수량 + 바로구매) ── */}
        {step === "select" && (
          <div className="card mt-10">
            <h3 className="h3 flex items-center gap-2">
              🛒 {t("payment.formTitle")}
            </h3>

            <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:gap-10">
              {/* LEFT: 선택된 제품 이미지 미리보기 */}
              <div>
                <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-border bg-white">
                  <img
                    src={selected?.imageUrl || PRODUCT_THUMB}
                    alt={dispName}
                    loading="lazy"
                    className="aspect-square w-full object-cover object-top"
                  />
                </div>

                <h4 className="mt-4 text-lg font-extrabold leading-snug text-text-primary">
                  {dispName}
                </h4>
                {dispDesc && (
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {dispDesc}
                  </p>
                )}
              </div>

              {/* RIGHT: 옵션(상품) + 수량 + 금액 + 바로구매 */}
              <div className="flex flex-col">
                <div className="space-y-4">
                  {hasProducts && (
                    <div className="field">
                      <label>{t("payment.productLabel")}</label>
                      <select
                        className="select"
                        value={selectedId}
                        onChange={(e) => setSelectedId(e.target.value)}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {p.amount} {p.currency}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {hasProducts && (
                    <div className="field">
                      <label>{t("payment.quantityLabel")}</label>
                      <select
                        className="select"
                        aria-label={t("payment.quantityLabel")}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                      >
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 금액 요약 */}
                <div className="mt-5 space-y-2 rounded-lg border border-border bg-bg-alt px-4 py-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-text-muted">
                      {t("payment.priceLabel")}
                    </span>
                    <span className="text-sm font-bold text-text-primary">
                      {dispAmount} {dispCurrency} × {quantity}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-border pt-2">
                    <span className="text-sm font-semibold text-text-muted">
                      {t("payment.totalAmount")}
                    </span>
                    <span className="text-2xl font-extrabold text-accent">
                      {dispTotal} {dispCurrency}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep("order")}
                  disabled={!canBuy}
                  className="btn btn-gold mt-4 w-full disabled:opacity-40"
                >
                  🛒 {t("payment.buyNow")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: 주문서 작성 카드 ── */}
        {step === "order" && (
          <div className="card mt-10">
            <h3 className="h3 flex items-center gap-2">
              📝 {t("payment.orderTitle")}
            </h3>

            {/* 1) 주문 상품 요약 (수량·가격·총 주문 금액) */}
            <div className="mt-6 rounded-lg border border-border bg-bg-alt p-4">
              <div className="flex items-center gap-4">
                <img
                  src={selected?.imageUrl || PRODUCT_THUMB}
                  alt={dispName}
                  loading="lazy"
                  className="h-16 w-16 rounded border border-border object-cover object-top"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-text-primary">
                    {dispName}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {t("payment.priceLabel")}: {dispAmount} {dispCurrency}
                  </p>
                </div>
                {hasProducts ? (
                  <div className="field !mb-0 w-20 shrink-0">
                    <label className="text-xs">
                      {t("payment.quantityLabel")}
                    </label>
                    <select
                      className="select"
                      aria-label={t("payment.quantityLabel")}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="shrink-0 text-sm text-text-muted">
                    {t("payment.quantityLabel")}: 1
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-sm font-semibold text-text-muted">
                  {t("payment.totalAmount")}
                </span>
                <span className="text-2xl font-extrabold text-accent">
                  {dispTotal} {dispCurrency}
                </span>
              </div>
            </div>

            {/* 2) 주문자 정보 */}
            <h4 className="mt-8 border-b border-border pb-2 text-base font-extrabold text-text-primary">
              {t("payment.ordererInfo")}
            </h4>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label>
                  {t("payment.nameLabel")} <span className="text-accent">*</span>
                </label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder={t("payment.namePlaceholder")}
                  required
                />
              </div>
              <div className="field">
                <label>
                  {t("payment.phoneLabel")} <span className="text-accent">*</span>
                </label>
                <input
                  className="input"
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder={t("payment.phonePlaceholder")}
                  required
                />
              </div>
              <div className="field sm:col-span-2">
                <label>{t("payment.emailLabel")}</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder={t("payment.emailPlaceholder")}
                />
                <p className="mt-1 text-xs text-text-muted">
                  {t("payment.credNote")}
                </p>
              </div>
            </div>

            {/* 3) 비회원 개인정보 수집·이용 동의 */}
            <h4 className="mt-8 border-b border-border pb-2 text-base font-extrabold text-text-primary">
              {t("payment.consentTitle")}
            </h4>
            <div className="mt-4 max-h-32 overflow-y-auto whitespace-pre-line rounded border border-border bg-bg-alt p-3 text-xs leading-relaxed text-text-secondary">
              {t("payment.consentBody")}
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-bold text-text-primary">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              {t("payment.consentAgree")} <span className="text-accent">*</span>
            </label>

            {/* 4) 배송지 정보 입력 */}
            <h4 className="mt-8 border-b border-border pb-2 text-base font-extrabold text-text-primary">
              {t("payment.shippingInfoTitle")}
            </h4>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label>
                  {t("payment.recipientLabel")}{" "}
                  <span className="text-accent">*</span>
                </label>
                <input
                  className="input"
                  value={form.recipient}
                  onChange={(e) => setField("recipient", e.target.value)}
                  placeholder={t("payment.recipientPlaceholder")}
                  required
                />
              </div>
              <div className="field">
                <label>{t("payment.telLabel")}</label>
                <input
                  className="input"
                  type="tel"
                  value={form.tel}
                  onChange={(e) => setField("tel", e.target.value)}
                  placeholder={t("payment.telPlaceholder")}
                />
              </div>
              <div className="field sm:col-span-2">
                <label>
                  {t("payment.addressLabel")}{" "}
                  <span className="text-accent">*</span>
                </label>
                <div className="grid gap-2">
                  <input
                    className="input"
                    value={form.postcode}
                    onChange={(e) => setField("postcode", e.target.value)}
                    placeholder={t("payment.postcodePlaceholder")}
                  />
                  <input
                    className="input"
                    value={form.address}
                    onChange={(e) => setField("address", e.target.value)}
                    placeholder={t("payment.addressPlaceholder")}
                    required
                  />
                  <input
                    className="input"
                    value={form.addressDetail}
                    onChange={(e) => setField("addressDetail", e.target.value)}
                    placeholder={t("payment.addressDetailPlaceholder")}
                  />
                </div>
              </div>
              <div className="field sm:col-span-2">
                <label>{t("payment.deliveryMsgLabel")}</label>
                <input
                  className="input"
                  value={form.deliveryMessage}
                  onChange={(e) => setField("deliveryMessage", e.target.value)}
                  placeholder={t("payment.deliveryMsgPlaceholder")}
                />
              </div>
            </div>

            {/* 결과 메시지 */}
            {payStatus.kind === "success" && (
              <div className="mt-6 rounded border border-[#b5e0c8] bg-[#e8f7ef] p-4 text-sm text-[#1a8a52]">
                <p className="font-bold">{t("payment.success")}</p>
                <p className="mt-1">
                  {t("payment.successMsg", { id: payStatus.orderId })}
                </p>
              </div>
            )}
            {payStatus.kind === "cancelled" && (
              <p className="mt-6 text-sm text-text-muted">
                {t("payment.cancelled")}
              </p>
            )}
            {payStatus.kind === "error" && (
              <p className="mt-6 text-sm text-red-600">{t("payment.error")}</p>
            )}

            {/* 5) 결제하기 / 이전으로 */}
            {payStatus.kind !== "success" && isAirwallexConfigured && (
              <div className="mt-6">
                {awxError && (
                  <p className="mb-2 text-center text-sm text-red-600">
                    결제창을 여는 데 실패했습니다. 잠시 후 다시 시도해 주세요.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("select")}
                    className="btn btn-outline shrink-0"
                  >
                    ← {t("payment.backToProduct")}
                  </button>
                  <button
                    type="button"
                    onClick={payWithAirwallex}
                    disabled={!canPay || awxBusy}
                    className="btn btn-gold w-full disabled:opacity-40"
                  >
                    {awxBusy
                      ? "결제창 여는 중…"
                      : `💳 ${t("payment.payNow")} (${dispTotal} ${dispCurrency})`}
                  </button>
                </div>
                {!canPay && (
                  <p className="mt-2 text-center text-sm text-text-muted">
                    {t("payment.needInfo")}
                  </p>
                )}
                {AIRWALLEX_IS_SANDBOX && (
                  <p className="mt-2 text-center text-xs text-accent">
                    테스트(샌드박스) 모드입니다. 실제 결제가 청구되지 않습니다.
                  </p>
                )}
              </div>
            )}

            {payStatus.kind !== "success" && !isAirwallexConfigured && (
              <p className="mt-6 text-sm text-text-muted">
                {t("payment.notConfigured")}
              </p>
            )}
          </div>
        )}

        {/* ── Lookup card ── */}
        <div className="card mt-6">
          <h3 className="h3 flex items-center gap-2">
            🔍 {t("payment.lookupTitle")}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {t("payment.lookupDesc")}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className="input"
              value={lookup.name}
              onChange={(e) => setLookup((l) => ({ ...l, name: e.target.value }))}
              placeholder={t("payment.lookupNamePlaceholder")}
            />
            <input
              className="input"
              type="tel"
              inputMode="numeric"
              value={lookup.phone}
              onChange={(e) => setLookup((l) => ({ ...l, phone: e.target.value }))}
              placeholder={t("payment.lookupPhonePlaceholder")}
            />
          </div>

          <button
            className="btn btn-gold mt-4 w-full"
            onClick={runLookup}
            disabled={lookupState.kind === "searching"}
          >
            {lookupState.kind === "searching"
              ? t("payment.lookupSearching")
              : t("payment.lookupBtn")}
          </button>

          {/* Result area */}
          <div className="mt-4 rounded border border-dashed border-border p-5">
            {lookupState.kind === "results" ? (
              <ul className="space-y-3">
                {lookupState.rows.map((r) => {
                  const requested = requestedIds.has(r.id);
                  const isOpen = refundOpenId === r.id;
                  return (
                    <li
                      key={r.id}
                      className="rounded border border-border bg-bg-alt p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-text-primary">
                          {r.packageName}
                        </span>
                        <span className="font-extrabold text-accent">
                          {r.amount} {r.currency}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                        {statusBadge(r.status)}
                        {r.status === "paid" && shippingBadge(r.shippingStatus)}
                        <span>
                          {t("payment.lookupOrder")}: {r.orderId}
                        </span>
                        <span>
                          {t("payment.lookupDate")}: {fmtDate(r.createdAt)}
                        </span>
                      </div>
                      {r.status === "paid" && (r.courier || r.trackingNo) && (
                        <p className="mt-1 text-xs text-text-secondary">
                          {t("payment.trackingInfo")}: {r.courier}
                          {r.courier && r.trackingNo ? " · " : ""}
                          {r.trackingNo}
                        </p>
                      )}

                      {/* Refund / cancel request — only for still-paid orders */}
                      {r.status === "paid" && (
                        <div className="mt-3 border-t border-border pt-3">
                          {requested ? (
                            <p className="text-xs text-[#1a8a52]">
                              ✅ {t("payment.refundRequested")}
                            </p>
                          ) : isOpen ? (
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-text-secondary">
                                {t("payment.refundReasonLabel")}
                              </label>
                              <textarea
                                className="textarea !min-h-[70px] text-sm"
                                value={refundReason}
                                onChange={(e) => setRefundReason(e.target.value)}
                                placeholder={t("payment.refundReasonPlaceholder")}
                              />
                              {refundErr && (
                                <p className="text-xs text-red-600">
                                  {t("payment.refundError")}
                                </p>
                              )}
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => submitRefund(r)}
                                  disabled={refundBusy}
                                  className="btn btn-gold !min-h-0 !py-2 text-xs"
                                >
                                  {refundBusy
                                    ? t("payment.refundSubmitting")
                                    : t("payment.refundSubmit")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRefundOpenId(null);
                                    setRefundReason("");
                                    setRefundErr(false);
                                  }}
                                  className="btn btn-outline !min-h-0 !py-2 text-xs"
                                >
                                  {t("payment.refundClose")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setRefundOpenId(r.id);
                                setRefundReason("");
                                setRefundErr(false);
                              }}
                              className="btn btn-outline !min-h-0 !py-2 text-xs"
                            >
                              {t("payment.refundBtn")}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
                <li>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    ℹ️ {t("payment.refundGuide")}
                  </p>
                </li>
              </ul>
            ) : (
              <p className="text-center text-sm text-text-muted">
                {lookupState.kind === "none"
                  ? t("payment.lookupNoResult")
                  : lookupState.kind === "needInfo"
                    ? t("payment.lookupNeedInfo")
                    : t("payment.lookupEmpty")}
              </p>
            )}
          </div>
        </div>

        {/* ── Live applicants ticker (social proof) — moved to the bottom ── */}
        <RecentApplicants />
      </div>
    </section>
  );
}
