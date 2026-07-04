"use client";

// Admin authentication (방식 A: Firebase Auth on the client, gated by an email
// allowlist). The SAME allowlist must be mirrored in firestore.rules → isAdmin()
// so the data layer — not just the UI — is locked to these accounts.
//
// Create the admin login in Firebase Console → Authentication → Users → Add user
// (email + password). See docs/ADMIN_SETUP.md.

import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getAuthClient, isFirebaseConfigured } from "./firebase";

/**
 * Allowed admin emails. Configurable via NEXT_PUBLIC_ADMIN_EMAILS
 * (comma-separated); falls back to the site owner. Keep this list in sync
 * with the array inside firestore.rules → isAdmin().
 */
export const ADMIN_EMAILS: string[] = (
  process.env.NEXT_PUBLIC_ADMIN_EMAILS || "thenatureheal@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export interface AdminAuthState {
  loading: boolean;
  user: User | null;
  isAdmin: boolean;
}

/** React hook: current admin auth state, kept live via onAuthStateChanged. */
export function useAdminAuth(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>({
    loading: true,
    user: null,
    isAdmin: false,
  });

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setState({ loading: false, user: null, isAdmin: false });
      return;
    }
    const unsub = onAuthStateChanged(getAuthClient(), (user) => {
      setState({
        loading: false,
        user,
        isAdmin: isAdminEmail(user?.email),
      });
    });
    return unsub;
  }, []);

  return state;
}

/** Sign in with email + password. Throws a friendly error on failure. */
export async function adminSignIn(
  email: string,
  password: string
): Promise<User> {
  const authClient = getAuthClient();
  const cred = await signInWithEmailAndPassword(
    authClient,
    email.trim(),
    password
  );
  if (!isAdminEmail(cred.user.email)) {
    // Signed in, but not on the allowlist → sign back out and reject.
    await signOut(authClient);
    throw new Error("NOT_ADMIN");
  }
  return cred.user;
}

export async function adminSignOut(): Promise<void> {
  await signOut(getAuthClient());
}
