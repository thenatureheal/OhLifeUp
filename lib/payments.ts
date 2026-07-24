import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "payments";
const DETAILS_COLLECTION = "paymentDetails";

/** Lifecycle status of a payment. Refund/cancel are recorded by an admin. */
export type PaymentStatus = "paid" | "refunded" | "cancelled";

/** Shipping progress, set by an admin: 배송준비중 → 배송중 → 배송완료. */
export type ShippingStatus = "preparing" | "shipping" | "delivered";

// Which provider processed this payment. New payments are always "airwallex";
// "paypal" is kept only so legacy documents read correctly.
export type PaymentProvider = "paypal" | "airwallex";

export interface PaymentRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  orderId: string;
  amount: string;
  currency: string;
  packageName: string;
  quantity: number;
  status: PaymentStatus;
  // Which provider processed the payment. Legacy docs have no field → "paypal".
  provider: PaymentProvider;
  // Best-effort payment-source info from the intent response.
  // Card FULL number is never available (PCI) — only brand + last 4 digits.
  cardBrand: string;
  cardLast4: string;
  // Provider transaction id used to match refund/reversal webhook events back to
  // this payment and to trigger the real refund (Airwallex → payment_intent id).
  captureId: string;
  // Shipping info shown to the buyer via the public lookup. The full shipping
  // ADDRESS is PII and lives in paymentDetails (admin-only), never here.
  shippingStatus: ShippingStatus;
  courier: string;
  trackingNo: string;
  createdAt: string | null;
}

export interface NewPayment {
  name: string;
  phone: string;
  email: string;
  orderId: string;
  amount: string;
  currency: string;
  packageName: string;
  quantity?: number;
  provider?: PaymentProvider;
  cardBrand?: string;
  cardLast4?: string;
  captureId?: string;
}

/**
 * Extra customer PII entered by an admin AFTER checkout. Stored in a SEPARATE
 * `paymentDetails/{paymentId}` collection that is admin-only (see
 * firestore.rules) so it is never exposed via the public payment lookup.
 */
export interface PaymentDetails {
  recipient: string;
  address: string;
  postcode: string;
  addressDetail: string;
  tel: string; // landline / secondary contact (optional)
  deliveryMessage: string;
  birthdate: string; // YYYY-MM-DD (free text)
  gender: string; // "male" | "female" | "other" | ""
  memo: string;
}

export const EMPTY_DETAILS: PaymentDetails = {
  recipient: "",
  address: "",
  postcode: "",
  addressDetail: "",
  tel: "",
  deliveryMessage: "",
  birthdate: "",
  gender: "",
  memo: "",
};

/** Keep only digits — normalize phone numbers for reliable matching. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function clampQty(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : 1;
}

function toISO(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

/**
 * Record a completed payment so the buyer can later look it up by name + phone.
 * Called from the Airwallex return page after the payment succeeds. The phone is
 * normalized to digits before storing.
 */
export async function recordPayment(input: NewPayment): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    name: input.name.trim(),
    phone: normalizePhone(input.phone),
    email: input.email.trim(),
    orderId: input.orderId,
    amount: input.amount,
    currency: input.currency,
    packageName: input.packageName,
    quantity: clampQty(input.quantity),
    status: "paid",
    provider: input.provider ?? "airwallex",
    cardBrand: (input.cardBrand ?? "").slice(0, 30),
    cardLast4: (input.cardLast4 ?? "").slice(0, 4),
    captureId: (input.captureId ?? "").slice(0, 100),
    shippingStatus: "preparing",
    courier: "",
    trackingNo: "",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

function mapPayment(id: string, data: Record<string, unknown>): PaymentRecord {
  return {
    id,
    name: data.name as string,
    phone: data.phone as string,
    email: (data.email as string) ?? "",
    orderId: (data.orderId as string) ?? "",
    amount: (data.amount as string) ?? "",
    currency: (data.currency as string) ?? "",
    packageName: (data.packageName as string) ?? "",
    quantity: clampQty(data.quantity),
    status: (data.status as PaymentStatus) ?? "paid",
    provider: (data.provider as PaymentProvider) ?? "paypal",
    cardBrand: (data.cardBrand as string) ?? "",
    cardLast4: (data.cardLast4 as string) ?? "",
    captureId: (data.captureId as string) ?? "",
    shippingStatus: (data.shippingStatus as ShippingStatus) ?? "preparing",
    courier: (data.courier as string) ?? "",
    trackingNo: (data.trackingNo as string) ?? "",
    createdAt: toISO(data.createdAt),
  };
}

// ─────────────────────────────────────────────────────────────
// Admin-only operations (gated by firestore.rules → isAdmin()).
// ─────────────────────────────────────────────────────────────

/** List every payment, newest first (admin only). */
export async function listAllPayments(): Promise<PaymentRecord[]> {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPayment(d.id, d.data()));
}

/** Update the lifecycle status of a payment (admin only). */
export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { status });
}

/** Read the admin-entered PII for a payment (admin only). */
export async function getPaymentDetails(
  paymentId: string
): Promise<PaymentDetails> {
  const snap = await getDoc(doc(db, DETAILS_COLLECTION, paymentId));
  if (!snap.exists()) return { ...EMPTY_DETAILS };
  const d = snap.data();
  return {
    recipient: d.recipient ?? "",
    address: d.address ?? "",
    postcode: d.postcode ?? "",
    addressDetail: d.addressDetail ?? "",
    tel: d.tel ?? "",
    deliveryMessage: d.deliveryMessage ?? "",
    birthdate: d.birthdate ?? "",
    gender: d.gender ?? "",
    memo: d.memo ?? "",
  };
}

/** Load PII for many payments at once → map keyed by paymentId (admin only). */
export async function listAllPaymentDetails(): Promise<
  Record<string, PaymentDetails>
> {
  const snap = await getDocs(collection(db, DETAILS_COLLECTION));
  const out: Record<string, PaymentDetails> = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    out[d.id] = {
      recipient: data.recipient ?? "",
      address: data.address ?? "",
      postcode: data.postcode ?? "",
      addressDetail: data.addressDetail ?? "",
      tel: data.tel ?? "",
      deliveryMessage: data.deliveryMessage ?? "",
      birthdate: data.birthdate ?? "",
      gender: data.gender ?? "",
      memo: data.memo ?? "",
    };
  });
  return out;
}

/** Create/overwrite the admin-entered PII for a payment (admin only). */
export async function savePaymentDetails(
  paymentId: string,
  details: PaymentDetails
): Promise<void> {
  await setDoc(doc(db, DETAILS_COLLECTION, paymentId), {
    recipient: details.recipient.trim().slice(0, 100),
    address: details.address.trim().slice(0, 300),
    postcode: details.postcode.trim().slice(0, 20),
    addressDetail: details.addressDetail.trim().slice(0, 200),
    tel: details.tel.trim().slice(0, 30),
    deliveryMessage: details.deliveryMessage.trim().slice(0, 200),
    birthdate: details.birthdate.trim().slice(0, 40),
    gender: details.gender.trim().slice(0, 20),
    memo: details.memo.trim().slice(0, 1000),
    updatedAt: serverTimestamp(),
  });
}

/** Update shipping status / courier / tracking number (admin only). */
export async function updateShipping(
  id: string,
  input: { shippingStatus: ShippingStatus; courier: string; trackingNo: string }
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    shippingStatus: input.shippingStatus,
    courier: input.courier.trim().slice(0, 50),
    trackingNo: input.trackingNo.trim().slice(0, 60),
  });
}

/**
 * Save the buyer-entered shipping address right after checkout. Called from the
 * Airwallex return page (guest, unauthenticated) — firestore.rules allows
 * CREATE-only on paymentDetails with this exact shape; read/update stay
 * admin-only so the address is never publicly readable.
 */
export async function saveShippingAddress(
  paymentId: string,
  input: {
    recipient: string;
    address: string;
    postcode: string;
    addressDetail: string;
    tel: string;
    deliveryMessage: string;
  }
): Promise<void> {
  await setDoc(doc(db, DETAILS_COLLECTION, paymentId), {
    recipient: input.recipient.trim().slice(0, 100),
    address: input.address.trim().slice(0, 300),
    postcode: input.postcode.trim().slice(0, 20),
    addressDetail: input.addressDetail.trim().slice(0, 200),
    tel: input.tel.trim().slice(0, 30),
    deliveryMessage: input.deliveryMessage.trim().slice(0, 200),
    birthdate: "",
    gender: "",
    memo: "",
    updatedAt: serverTimestamp(),
  });
}

/**
 * Look up payments by exact name + normalized phone.
 *
 * SECURITY NOTE: with the "방식 A" (direct client access) design the `payments`
 * collection must be readable for this query to run, so the data is not truly
 * private. For production, move this lookup behind a server (Route Handler /
 * Admin SDK) and lock the collection down.
 */
export async function lookupPayments(
  name: string,
  phone: string
): Promise<PaymentRecord[]> {
  const q = query(
    collection(db, COLLECTION),
    where("name", "==", name.trim()),
    where("phone", "==", normalizePhone(phone)),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPayment(d.id, d.data()));
}
