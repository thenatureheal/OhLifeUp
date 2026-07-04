"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth, adminSignOut } from "@/lib/admin";
import { isFirebaseConfigured } from "@/lib/firebase";
import { countUnread } from "@/lib/notifications";

const NAV = [
  { href: "/admin", label: "대시보드", icon: "📊", exact: true },
  { href: "/admin/payments", label: "결제 목록", icon: "💳" },
  { href: "/admin/products", label: "상품 관리", icon: "🏷️" },
  { href: "/admin/inquiries", label: "문의 관리", icon: "✉️" },
  { href: "/admin/notifications", label: "알림", icon: "🔔" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, isAdmin, user } = useAdminAuth();
  const [unread, setUnread] = useState(0);

  const isLoginPage = pathname === "/admin/login";

  // Guard: bounce non-admins to the login page (except on the login page itself).
  useEffect(() => {
    if (loading || isLoginPage) return;
    if (!isAdmin) router.replace("/admin/login");
  }, [loading, isAdmin, isLoginPage, router]);

  // Unread badge for the sidebar bell.
  useEffect(() => {
    if (!isAdmin) return;
    countUnread().then(setUnread).catch(() => setUnread(0));
  }, [isAdmin, pathname]);

  // The login page renders standalone (no shell / no guard).
  if (isLoginPage) return <div className="min-h-[70vh]">{children}</div>;

  if (!isFirebaseConfigured) {
    return (
      <div className="wrap-narrow py-20 text-center">
        <p className="text-text-muted">
          Firebase 환경변수가 설정되지 않아 관리자 기능을 사용할 수 없습니다.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="wrap-narrow py-24 text-center text-text-muted">
        불러오는 중...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="wrap-narrow py-24 text-center text-text-muted">
        관리자 로그인이 필요합니다. 이동 중...
      </div>
    );
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="wrap py-8">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-4">
            <div className="mb-4 border-b border-border pb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">
                관리자
              </p>
              <p className="mt-1 truncate text-xs text-text-muted">
                {user?.email}
              </p>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded px-3 py-2 text-sm transition-colors ${
                    isActive(item.href, item.exact)
                      ? "bg-[#fdf6e3] font-bold text-accent"
                      : "text-text-secondary hover:bg-bg-alt hover:text-text-primary"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    {item.label}
                  </span>
                  {item.href === "/admin/notifications" && unread > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
            <button
              onClick={async () => {
                await adminSignOut();
                router.replace("/admin/login");
              }}
              className="btn btn-outline mt-4 w-full !min-h-0 !py-2 text-xs"
            >
              로그아웃
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
