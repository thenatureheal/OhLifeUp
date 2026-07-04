"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  recordPayment,
  lookupPayments,
  type PaymentRecord,
} from "@/lib/payments";
import { createNotification } from "@/lib/notifications";
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
  const canPay = form.name.trim().length > 0 && form.phone.trim().length > 0;

  // ── Payment lookup ──
  const [lookup, setLookup] = useState({ name: "", phone: "" });
  const [lookupState, setLookupState] = useState<LookupState>({ kind: "idle" });

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

            {/* Product card */}
            <div className="field">
              <label>{t("payment.productLabel")}</label>
              <div className="flex items-center justify-between gap-4 rounded border-2 border-accent/40 bg-[#fdf6e3] p-4">
                <div>
                  <p className="font-bold text-text-primary">
                    {t("payment.packageName")}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {t("payment.packageDesc")}
                  </p>
                </div>
                <span className="whitespace-nowrap text-lg font-extrabold text-text-primary">
                  ${AMOUNT} {CURRENCY}
                </span>
              </div>
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
                      options={{
                        clientId: CLIENT_ID,
                        currency: CURRENCY,
                        components: "buttons",
                        intent: "capture",
                      }}
                    >
                      <PayPalButtons
                        forceReRender={[canPay, CURRENCY]}
                        disabled={!canPay}
                        style={{ layout: "vertical", shape: "rect", label: "pay" }}
                        createOrder={async () => {
                          const res = await fetch("/api/paypal/orders", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
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
                            if (isFirebaseConfigured) {
                              try {
                                const paymentId = await recordPayment({
                                  name: form.name,
                                  phone: form.phone,
                                  email: form.email,
                                  orderId,
                                  amount: AMOUNT,
                                  currency: CURRENCY,
                                  packageName: t("payment.packageName"),
                                });
                                // Notify the admin dashboard (best-effort).
                                try {
                                  await createNotification(
                                    "payment",
                                    `새 결제: ${form.name.trim()}`,
                                    `${t("payment.packageName")} · $${AMOUNT} ${CURRENCY} (주문 ${orderId})`,
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
                {lookupState.rows.map((r) => (
                  <li
                    key={r.id}
                    className="rounded border border-border bg-bg-alt p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-text-primary">
                        {r.packageName}
                      </span>
                      <span className="font-extrabold text-accent">
                        ${r.amount} {r.currency}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                      <span>
                        {t("payment.lookupOrder")}: {r.orderId}
                      </span>
                      <span>
                        {t("payment.lookupDate")}: {fmtDate(r.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
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
