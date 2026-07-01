import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "payments";

export interface PaymentRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  orderId: string;
  amount: string;
  currency: string;
  packageName: string;
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
}

/** Keep only digits — normalize phone numbers for reliable matching. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function toISO(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

/**
 * Record a completed payment so the buyer can later look it up by name + phone.
 * Called from onApprove after the PayPal order is captured. The phone is
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
    createdAt: serverTimestamp(),
  });
  return ref.id;
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
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      orderId: data.orderId,
      amount: data.amount,
      currency: data.currency,
      packageName: data.packageName,
      createdAt: toISO(data.createdAt),
    };
  });
}
