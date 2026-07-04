"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminSignIn, useAdminAuth } from "@/lib/admin";
import { isFirebaseConfigured } from "@/lib/firebase";

export default function AdminLoginPage() {
  const router = useRouter();
  const { isAdmin, loading } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already signed in as admin → go straight to the dashboard.
  useEffect(() => {
    if (!loading && isAdmin) router.replace("/admin");
  }, [loading, isAdmin, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await adminSignIn(email, password);
      router.replace("/admin");
    } catch (err) {
      const code =
        err instanceof Error ? err.message : String(err ?? "");
      if (code === "NOT_ADMIN") {
        setError("관리자 권한이 없는 계정입니다.");
      } else if (
        code.includes("invalid-credential") ||
        code.includes("wrong-password") ||
        code.includes("user-not-found") ||
        code.includes("invalid-email")
      ) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else if (code.includes("too-many-requests")) {
        setError("잠시 후 다시 시도해주세요. (로그인 시도 과다)");
      } else {
        setError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wrap-narrow flex min-h-[70vh] items-center justify-center py-16">
      <div className="card w-full max-w-md">
        <h1 className="h3 text-center">🔐 관리자 로그인</h1>
        <p className="mt-2 text-center text-sm text-text-muted">
          OhLifeUp 운영자 전용 페이지입니다.
        </p>

        {!isFirebaseConfigured && (
          <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            Firebase 환경변수가 설정되지 않았습니다.
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="field">
            <label>이메일</label>
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          <div className="field">
            <label>비밀번호</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            className="btn btn-gold w-full"
            disabled={submitting || !isFirebaseConfigured}
          >
            {submitting ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
