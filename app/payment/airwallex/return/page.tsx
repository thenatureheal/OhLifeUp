"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isFirebaseConfigured } from "@/lib/firebase";
import { recordPayment, saveShippingAddress } from "@/lib/payments";
import { createNotification } from "@/lib/notifications";

// Airwallex redirects the shopper here after the hosted payment page. The buyer
// info was stashed in sessionStorage before the redirect (see PackagePay). We:
//   1) verify the PaymentIntent status SERVER-side (never trust the client),
//   2) record the payment in Firestore when it truly succeeded (like PayPal's
//      onApprove), then clear the stash so a refresh doesn't double-record.
const STORAGE_KEY = "awx_pending";

interface Pending {
  intentId: string;
  name: string;
  phone: string;
  email: string;
  recipient?: string;
  postcode?: string;
  address?: string;
  addressDetail?: string;
  tel?: string;
  deliveryMessage?: string;
  quantity?: number;
  packageName: string;
}

type View =
  | { kind: "verifying" }
  | { kind: "success"; orderId: string }
  | { kind: "failed" }
  | { kind: "expired" };

export default function AirwallexReturnPage() {
  const [view, setView] = useState<View>({ kind: "verifying" });
  // React 18 StrictMode mounts effects twice in dev — guard so we confirm once.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let pending: Pending | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      pending = raw ? (JSON.parse(raw) as Pending) : null;
    } catch {
      pending = null;
    }

    // No stash (direct visit or already handled on a previous load).
    if (!pending?.intentId) {
      setView({ kind: "expired" });
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/airwallex/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intentId: pending!.intentId }),
        });
        const data = await res.json();

        if (!res.ok || !data.succeeded) {
          setView({ kind: "failed" });
          return;
        }

        // Server-verified amount/currency + card info are the source of truth.
        if (isFirebaseConfigured) {
          try {
            const paymentId = await recordPayment({
              name: pending!.name,
              phone: pending!.phone,
              email: pending!.email,
              orderId: data.id,
              amount: String(data.amount),
              currency: String(data.currency),
              packageName: pending!.packageName,
              quantity: pending!.quantity,
              provider: "airwallex",
              cardBrand: data.cardBrand ?? "",
              cardLast4: data.cardLast4 ?? "",
              captureId: data.id, // payment_intent id → used for refund + webhook match
            });
            // Save the shipping address into the admin-only paymentDetails doc.
            // Failure here must never fail the payment record itself.
            if (pending!.address?.trim()) {
              try {
                await saveShippingAddress(paymentId, {
                  recipient: pending!.recipient?.trim() || pending!.name,
                  address: pending!.address ?? "",
                  postcode: pending!.postcode ?? "",
                  addressDetail: pending!.addressDetail ?? "",
                  tel: pending!.tel ?? "",
                  deliveryMessage: pending!.deliveryMessage ?? "",
                });
              } catch (e) {
                console.error("saveShippingAddress failed", e);
              }
            }
            try {
              await createNotification(
                "payment",
                `새 결제: ${pending!.name}`,
                `${pending!.packageName} · ${data.amount} ${data.currency} (Airwallex, intent ${data.id})`,
                paymentId
              );
            } catch (e) {
              console.error("payment notification failed", e);
            }
          } catch (e) {
            console.error("recordPayment failed", e);
          }
        }

        // Clear the stash so a refresh won't record again.
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setView({ kind: "success", orderId: data.id });
      } catch (e) {
        console.error(e);
        setView({ kind: "failed" });
      }
    })();
  }, []);

  return (
    <section className="section">
      <div className="wrap-narrow">
        <div className="card mx-auto max-w-md text-center">
          {view.kind === "verifying" && (
            <>
              <h2 className="h3">결제 확인 중…</h2>
              <p className="mt-3 text-sm text-text-muted">
                Airwallex 결제 결과를 확인하고 있습니다. 잠시만 기다려 주세요.
              </p>
            </>
          )}

          {view.kind === "success" && (
            <>
              <div className="text-4xl">✅</div>
              <h2 className="h3 mt-3">결제가 완료되었습니다</h2>
              <p className="mt-2 text-sm text-text-secondary">
                주문번호:{" "}
                <span className="select-text font-mono" style={{ userSelect: "text" }}>
                  {view.orderId}
                </span>
              </p>
              <p className="mt-1 text-xs text-text-muted">
                결제 내역은 결제 페이지의 “내 결제 조회”에서 이름·연락처로 확인하실 수 있습니다.
              </p>
              <Link href="/#payment" className="btn btn-gold mt-6 w-full">
                결제 페이지로 돌아가기
              </Link>
            </>
          )}

          {view.kind === "failed" && (
            <>
              <div className="text-4xl">❌</div>
              <h2 className="h3 mt-3">결제가 완료되지 않았습니다</h2>
              <p className="mt-2 text-sm text-text-secondary">
                결제가 취소되었거나 승인되지 않았습니다. 다시 시도해 주세요.
              </p>
              <Link href="/#payment" className="btn btn-outline mt-6 w-full">
                다시 시도하기
              </Link>
            </>
          )}

          {view.kind === "expired" && (
            <>
              <h2 className="h3">결제 정보를 찾을 수 없습니다</h2>
              <p className="mt-2 text-sm text-text-secondary">
                이미 처리되었거나 세션이 만료되었습니다. 결제 페이지에서 내역을 확인해 주세요.
              </p>
              <Link href="/#payment" className="btn btn-outline mt-6 w-full">
                결제 페이지로 이동
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
