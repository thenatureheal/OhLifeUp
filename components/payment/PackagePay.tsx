"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  recordPayment,
  lookupPayments,
  type PaymentRecord,
} from "@/lib/payments";
import { createNotification } from "@/lib/notifications";
import { createRefundRequest } from "@/lib/inquiries";
import { listActiveProducts, type Product } from "@/lib/products";
import { fmtDate } from "@/lib/format";

// Client id renders the buttons (public). Order creation & capture happen on
// our server (/api/paypal/*), which controls the real amount. Sandbox vs live is
// determined by which client id + secret you configure (see docs/PAYPAL_SETUP.md).
const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
const AMOUNT = process.env.NEXT_PUBLIC_PAYPAL_AMOUNT || "122.00";
const CURRENCY = process.env.NEXT_PUBLIC_PAYPAL_CURRENCY || "USD";
const isPayPalConfigured = CLIENT_ID.length > 0;
// Display-only flag (server enforces the real env). "sandbox" unless explicitly live.
const IS_SANDBOX = (process.env.NEXT_PUBLIC_PAYPAL_ENV || "sandbox") !== "live";

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

  // ── Application form ──
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
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

  // Effective display/charge values: selected product, else env fallback.
  const dispName = selected?.name ?? t("payment.packageName");
  const dispDesc = selected?.description ?? t("payment.packageDesc");
  const dispAmount = selected?.amount ?? AMOUNT;
  const dispCurrency = selected?.currency ?? CURRENCY;

  const canPay =
    form.name.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    (!hasProducts || Boolean(selected));

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
            ? { productId: selected.id, packageName: dispName }
            : { packageName: dispName }
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
      <div className="wrap-narrow">
        {/* Heading */}
        <div className="animate-fade-up text-center">
          <span className="label text-accent">{t("payment.label")}</span>
          <h2 className="h2 mt-2">{t("payment.sectionTitle")}</h2>
          <p className="body-lg mx-auto mt-3 max-w-xl">
            {t("payment.sectionSubtitle")}
          </p>
          <div className="divider mx-auto" />
        </div>

        {/* ── Application & payment card ── */}
        <div className="card mt-10">
          <h3 className="h3 flex items-center gap-2">
            💳 {t("payment.formTitle")}
          </h3>

          <div className="mt-6 space-y-4">
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
              <p className="mt-1 text-xs text-text-muted">{t("payment.credNote")}</p>
            </div>

            <div className="field">
              <label>{t("payment.emailLabel")}</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder={t("payment.emailPlaceholder")}
              />
            </div>

            {/* Product selection */}
            <div className="field">
              <label>{t("payment.productLabel")}</label>

              {hasProducts ? (
                <div className="space-y-2">
                  {products.map((p) => {
                    const active = p.id === selectedId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedId(p.id)}
                        className={`flex w-full items-center justify-between gap-4 rounded border-2 p-4 text-left transition-colors ${
                          active
                            ? "border-accent bg-[#fdf6e3]"
                            : "border-border bg-bg hover:border-accent/50"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-text-primary">
                            {active ? "✓ " : ""}
                            {p.name}
                          </p>
                          {p.description && (
                            <p className="mt-1 text-xs text-text-muted">
                              {p.description}
                            </p>
                          )}
                        </div>
                        <span className="whitespace-nowrap text-lg font-extrabold text-text-primary">
                          {p.amount} {p.currency}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                // Legacy env fallback (single product)
                <div className="flex items-center justify-between gap-4 rounded border-2 border-accent/40 bg-[#fdf6e3] p-4">
                  <div>
                    <p className="font-bold text-text-primary">{dispName}</p>
                    <p className="mt-1 text-xs text-text-muted">{dispDesc}</p>
                  </div>
                  <span className="whitespace-nowrap text-lg font-extrabold text-text-primary">
                    {AMOUNT} {CURRENCY}
                  </span>
                </div>
              )}
            </div>
          </div>

          {IS_SANDBOX && (
            <p className="mt-4 text-xs text-accent">{t("payment.sandboxNotice")}</p>
          )}

          {/* Result messages */}
          {payStatus.kind === "success" && (
            <div className="mt-6 rounded border border-[#b5e0c8] bg-[#e8f7ef] p-4 text-sm text-[#1a8a52]">
              <p className="font-bold">{t("payment.success")}</p>
              <p className="mt-1">
                {t("payment.successMsg", { id: payStatus.orderId })}
              </p>
            </div>
          )}
          {payStatus.kind === "cancelled" && (
            <p className="mt-4 text-sm text-text-muted">{t("payment.cancelled")}</p>
          )}
          {payStatus.kind === "error" && (
            <p className="mt-4 text-sm text-red-600">{t("payment.error")}</p>
          )}

          {/* PayPal + card buttons (order created & captured server-side) */}
          {payStatus.kind !== "success" && (
            <div className="mt-6">
              {!isPayPalConfigured ? (
                <p className="text-sm text-text-muted">
                  {t("payment.notConfigured")}
                </p>
              ) : (
                <>
                  {!canPay && (
                    <p className="mb-3 text-sm text-text-muted">
                      {t("payment.needInfo")}
                    </p>
                  )}
                  <div className={canPay ? "" : "pointer-events-none opacity-40"}>
                    <PayPalScriptProvider
                      key={dispCurrency}
                      options={{
                        clientId: CLIENT_ID,
                        currency: dispCurrency,
                        components: "buttons",
                        intent: "capture",
                      }}
                    >
                      <PayPalButtons
                        forceReRender={[canPay, dispCurrency, dispAmount, selectedId]}
                        disabled={!canPay}
                        style={{ layout: "vertical", shape: "rect", label: "pay" }}
                        createOrder={async () => {
                          const res = await fetch("/api/paypal/orders", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(
                              selected ? { productId: selected.id } : {}
                            ),
                          });
                          const data = await res.json();
                          if (!res.ok || !data.id) {
                            throw new Error(data.error || "create order failed");
                          }
                          return data.id as string;
                        }}
                        onApprove={async (data) => {
                          try {
                            const res = await fetch(
                              `/api/paypal/orders/${data.orderID}/capture`,
                              { method: "POST" }
                            );
                            const result = await res.json();
                            if (!res.ok || result.status !== "COMPLETED") {
                              throw new Error(result.error || "capture failed");
                            }
                            const orderId = result.id ?? data.orderID ?? "";
                            // Best-effort payment-source info (card brand/last4,
                            // PayPal email) — present only when PayPal returns it.
                            const src = result?.payment_source ?? {};
                            const card = src?.card ?? {};
                            const cardBrand = card?.brand ?? "";
                            const cardLast4 = card?.last_digits ?? "";
                            const paypalEmail =
                              src?.paypal?.email_address ??
                              result?.payer?.email_address ??
                              "";
                            const captureId =
                              result?.purchase_units?.[0]?.payments
                                ?.captures?.[0]?.id ?? "";
                            if (isFirebaseConfigured) {
                              try {
                                const paymentId = await recordPayment({
                                  name: form.name,
                                  phone: form.phone,
                                  email: form.email,
                                  orderId,
                                  amount: dispAmount,
                                  currency: dispCurrency,
                                  packageName: dispName,
                                  cardBrand,
                                  cardLast4,
                                  paypalEmail,
                                  captureId,
                                });
                                try {
                                  await createNotification(
                                    "payment",
                                    `새 결제: ${form.name.trim()}`,
                                    `${dispName} · ${dispAmount} ${dispCurrency} (주문 ${orderId})`,
                                    paymentId
                                  );
                                } catch (e) {
                                  console.error("payment notification failed", e);
                                }
                              } catch (e) {
                                console.error("recordPayment failed", e);
                              }
                            }
                            setPayStatus({ kind: "success", orderId });
                          } catch (err) {
                            console.error(err);
                            setPayStatus({ kind: "error" });
                          }
                        }}
                        onCancel={() => setPayStatus({ kind: "cancelled" })}
                        onError={(err) => {
                          console.error(err);
                          setPayStatus({ kind: "error" });
                        }}
                      />
                    </PayPalScriptProvider>
                  </div>
                  <p className="mt-2 text-center text-xs text-text-muted">
                    {t("payment.poweredBy")}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Airwallex — card payment via Hosted Payment Page (redirect) */}
          {payStatus.kind !== "success" && isAirwallexConfigured && (
            <div className="mt-4 border-t border-border pt-5">
              <p className="mb-3 text-center text-xs font-bold text-text-muted">
                {isPayPalConfigured ? "또는 카드로 결제" : "카드로 결제"}
              </p>
              {awxError && (
                <p className="mb-2 text-center text-sm text-red-600">
                  결제창을 여는 데 실패했습니다. 잠시 후 다시 시도해 주세요.
                </p>
              )}
              <button
                type="button"
                onClick={payWithAirwallex}
                disabled={!canPay || awxBusy}
                className="btn btn-gold w-full disabled:opacity-40"
              >
                {awxBusy ? "결제창 여는 중…" : "💳 카드로 결제하기"}
              </button>
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
        </div>

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
                        <span>
                          {t("payment.lookupOrder")}: {r.orderId}
                        </span>
                        <span>
                          {t("payment.lookupDate")}: {fmtDate(r.createdAt)}
                        </span>
                      </div>

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
      </div>
    </section>
  );
}
