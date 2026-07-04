"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { LANGS, STORAGE_KEY } from "@/i18n/config";

const NAV = [
  { href: "/", key: "nav.intro" },
  { href: "/board", key: "nav.board" },
  { href: "/contact", key: "nav.contact" },
] as const;

export default function Header() {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile overlay is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const changeLang = (code: string) => {
    i18n.changeLanguage(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 h-16 border-b transition-all duration-200 ${
        scrolled || menuOpen
          ? "border-border bg-white/90 backdrop-blur"
          : "border-transparent bg-white/60 backdrop-blur-sm"
      }`}
    >
      <div className="wrap flex h-full items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          onClick={closeMenu}
          className="text-xl font-extrabold tracking-tight text-text-primary"
        >
          Oh<span className="text-accent">LifeUp</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 text-sm transition-colors ${
                isActive(item.href)
                  ? "font-bold text-accent"
                  : "font-medium text-text-secondary hover:text-text-primary"
              }`}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        {/* Desktop right cluster */}
        <div className="hidden items-center gap-3 lg:flex">
          <div className="flex items-center gap-1">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => changeLang(l.code)}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  i18n.language === l.code
                    ? "font-bold text-accent"
                    : "text-text-muted hover:text-text-primary"
                }`}
                aria-pressed={i18n.language === l.code}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 lg:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <span
            className={`block h-0.5 w-6 bg-text-primary transition-transform duration-200 ${
              menuOpen ? "translate-y-2 rotate-45" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-6 bg-text-primary transition-opacity duration-200 ${
              menuOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-6 bg-text-primary transition-transform duration-200 ${
              menuOpen ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 top-16 z-40 bg-white transition-transform duration-300 lg:hidden ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="wrap flex h-full flex-col gap-2 py-8">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className={`border-b border-border py-4 text-lg ${
                isActive(item.href)
                  ? "font-bold text-accent"
                  : "font-medium text-text-primary"
              }`}
            >
              {t(item.key)}
            </Link>
          ))}

          <div className="mt-4 flex items-center gap-2">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => changeLang(l.code)}
                className={`rounded border px-4 py-2 text-sm transition-colors ${
                  i18n.language === l.code
                    ? "border-accent font-bold text-accent"
                    : "border-border text-text-secondary"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
