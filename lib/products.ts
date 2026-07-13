import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "products";

/**
 * A purchasable product shown on the payment page. The `amount` is the price
 * PayPal charges — the SERVER reads it from Firestore at order-creation time
 * (see app/api/paypal/orders/route.ts) so the charged amount can't be tampered
 * with from the browser. Only admins can write (see firestore.rules).
 */
export interface Product {
  id: string;
  name: string;
  description: string;
  amount: string; // e.g. "122.00"
  currency: string; // e.g. "USD"
  imageUrl: string; // data URL (inline) or external URL; "" when none
  active: boolean;
  sortOrder: number;
  createdAt: string | null;
}

export interface ProductInput {
  name: string;
  description: string;
  amount: string;
  currency: string;
  imageUrl: string;
  active: boolean;
  sortOrder: number;
}

function toISO(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

function mapProduct(id: string, d: Record<string, unknown>): Product {
  return {
    id,
    name: (d.name as string) ?? "",
    description: (d.description as string) ?? "",
    amount: (d.amount as string) ?? "",
    currency: (d.currency as string) ?? "USD",
    imageUrl: (d.imageUrl as string) ?? "",
    active: d.active !== false,
    sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : 0,
    createdAt: toISO(d.createdAt),
  };
}

/** Normalize a price string to a 2-decimal value, or "" if invalid. */
export function normalizeAmount(raw: string): string {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toFixed(2);
}

/**
 * List all products, sorted by sortOrder then creation time. No composite index
 * needed — we sort in memory (the product list is small).
 */
export async function listProducts(): Promise<Product[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  const rows = snap.docs.map((d) => mapProduct(d.id, d.data()));
  rows.sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
  );
  return rows;
}

/** Active products only (for the public payment page). */
export async function listActiveProducts(): Promise<Product[]> {
  return (await listProducts()).filter((p) => p.active);
}

/** Fetch one product by id (used by the server order route — read-only, public). */
export async function getProduct(id: string): Promise<Product | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return mapProduct(snap.id, snap.data());
}

/** Create a product (admin only). */
export async function createProduct(input: ProductInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    name: input.name.trim().slice(0, 200),
    description: input.description.trim().slice(0, 1000),
    amount: input.amount,
    currency: input.currency.trim().slice(0, 10) || "USD",
    imageUrl: input.imageUrl ?? "",
    active: input.active,
    sortOrder: input.sortOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Update a product (admin only). */
export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    name: input.name.trim().slice(0, 200),
    description: input.description.trim().slice(0, 1000),
    amount: input.amount,
    currency: input.currency.trim().slice(0, 10) || "USD",
    imageUrl: input.imageUrl ?? "",
    active: input.active,
    sortOrder: input.sortOrder,
    updatedAt: serverTimestamp(),
  });
}

/** Delete a product (admin only). */
export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
