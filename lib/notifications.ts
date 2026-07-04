import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "notifications";

/**
 * Notification / audit-log event types.
 * - payment / inquiry: created by the public site action (validated by rules).
 * - refund / cancel:    created by an admin from the dashboard (admin-only).
 */
export type NotificationType = "payment" | "inquiry" | "refund" | "cancel";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  refId: string; // related payment/inquiry doc id (or "")
  read: boolean;
  createdAt: string | null;
}

function toISO(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

/**
 * Record a notification (also serves as the audit log). The shape must match
 * firestore.rules → isValidNotification() for public (payment/inquiry) events.
 */
export async function createNotification(
  type: NotificationType,
  title: string,
  message: string,
  refId = ""
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    type,
    title: title.slice(0, 200),
    message: message.slice(0, 500),
    refId: refId.slice(0, 100),
    read: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** List notifications, newest first (admin only). */
export async function listNotifications(): Promise<AppNotification[]> {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      type: data.type,
      title: data.title,
      message: data.message,
      refId: data.refId ?? "",
      read: Boolean(data.read),
      createdAt: toISO(data.createdAt),
    };
  });
}

/** Count unread notifications (admin only). */
export async function countUnread(): Promise<number> {
  const q = query(collection(db, COLLECTION), where("read", "==", false));
  const snap = await getDocs(q);
  return snap.size;
}

/** Mark a single notification read (admin only). */
export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { read: true });
}

/** Mark every unread notification read (admin only). */
export async function markAllNotificationsRead(): Promise<void> {
  const q = query(collection(db, COLLECTION), where("read", "==", false));
  const snap = await getDocs(q);
  await Promise.all(
    snap.docs.map((d) => updateDoc(doc(db, COLLECTION, d.id), { read: true }))
  );
}
