import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "inquiries";

export type InquiryStatus = "new" | "answered";
export type InquiryKind = "general" | "refund";

export interface Inquiry {
  id: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  kind: InquiryKind;
  orderId: string;
  status: InquiryStatus;
  reply: string;
  createdAt: string | null;
  repliedAt: string | null;
}

export interface NewInquiry {
  name: string;
  phone: string;
  email: string;
  message: string;
  kind?: InquiryKind;
  orderId?: string;
}

function toISO(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

/**
 * Submit a customer inquiry (public). Shape must match firestore.rules →
 * isValidInquiry(): status starts as "new", reply/repliedAt are set later by an
 * admin, so they are intentionally NOT part of the create payload.
 */
export async function createInquiry(input: NewInquiry): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    message: input.message.trim(),
    kind: input.kind ?? "general",
    orderId: (input.orderId ?? "").trim(),
    status: "new",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Customer-initiated refund/cancel request. Recorded as a "refund" inquiry so
 * the admin can see + reply to it in the same 문의 관리 screen, then process the
 * actual refund with the payment provider and flip the payment status.
 */
export async function createRefundRequest(input: {
  name: string;
  phone: string;
  email: string;
  orderId: string;
  amount: string;
  currency: string;
  reason: string;
}): Promise<string> {
  const message =
    `[환불·취소 신청]\n` +
    `주문번호: ${input.orderId}\n` +
    `금액: ${input.amount} ${input.currency}\n` +
    `사유: ${input.reason.trim() || "(미기재)"}`;
  return createInquiry({
    name: input.name,
    phone: input.phone,
    email: input.email,
    message,
    kind: "refund",
    orderId: input.orderId,
  });
}

/** List all inquiries, newest first (admin only). */
export async function listInquiries(): Promise<Inquiry[]> {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      phone: data.phone ?? "",
      email: data.email ?? "",
      message: data.message,
      kind: (data.kind as InquiryKind) ?? "general",
      orderId: data.orderId ?? "",
      status: (data.status as InquiryStatus) ?? "new",
      reply: data.reply ?? "",
      createdAt: toISO(data.createdAt),
      repliedAt: toISO(data.repliedAt),
    };
  });
}

/** Save an admin reply and flip the inquiry to "answered" (admin only). */
export async function replyToInquiry(id: string, reply: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    reply: reply.trim(),
    status: "answered",
    repliedAt: serverTimestamp(),
  });
}
