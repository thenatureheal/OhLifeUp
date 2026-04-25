
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LANGS = [
    { code: 'ko', label: '한국어' },
    { code: 'en', label: 'EN' },
    { code: 'zh', label: '中文' },
];

const Header = ({ page, setPage }) => {
    const { t, i18n } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 24);
        window.addEventListener('scroll', fn);
        return () => window.removeEventListener('scroll', fn);
    }, []);

    const nav = (p) => { setPage(p); setMenuOpen(false); window.scrollTo({ top: 0 }); };

    return (
        <>
            <header style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                background: scrolled || menuOpen ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0)',
                backdropFilter: scrolled || menuOpen ? 'blur(16px)' : 'none',
                borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
                transition: 'var(--transit)',
            }}>
                <div className="wrap" style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Logo */}
                    <button
                        onClick={() => nav('intro')}
                        style={{ fontSize: 'var(--t-xl)', fontWeight: 900, letterSpacing: '-0.05em', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
                    >
                        Oh<span style={{ color: 'var(--accent)' }}>LifeUp</span>
                    </button>

                    {/* Desktop Nav */}
                    <nav className="desktop-only" style={{ alignItems: 'center', gap: '2.5rem' }}>
                        {['intro', 'board'].map(p => (
                            <button key={p} onClick={() => nav(p)} style={{
                                fontSize: 'var(--t-sm)', fontWeight: page === p ? 700 : 500,
                                color: page === p ? 'var(--accent)' : 'var(--text-secondary)',
                                background: 'none', border: 'none', cursor: 'pointer', transition: 'var(--transit)',
                                borderBottom: page === p ? '2px solid var(--accent)' : '2px solid transparent',
                                paddingBottom: '2px',
                            }}>
                                {t(`nav.${p}`)}
                            </button>
                        ))}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {LANGS.map(l => (
                                <button key={l.code} onClick={() => i18n.changeLanguage(l.code)} style={{
                                    fontSize: 'var(--t-xs)', fontWeight: i18n.language === l.code ? 700 : 400,
                                    color: i18n.language === l.code ? 'var(--accent)' : 'var(--text-muted)',
                                    padding: '0.3rem 0.5rem', borderRadius: 6,
                                    border: i18n.language === l.code ? '1px solid var(--accent)' : '1px solid transparent',
                                    background: 'none', cursor: 'pointer', transition: 'var(--transit)',
                                }}>
                                    {l.label}
                                </button>
                            ))}
                        </div>
                        <button
                            className="btn btn-gold"
                            style={{ width: '80%', fontSize: 'var(--t-lg)', marginTop: '1.5rem' }}
                            onClick={() => window.open("https://open.kakao.com/o/sX6Ip2ri")}
                        >
                            {t('hero.cta')}
                        </button>

                        {/* Mobile Hamburger */}
                        <button
                            className="mobile-only"
                            onClick={() => setMenuOpen(!menuOpen)}
                            style={{ flexDirection: 'column', gap: '5px', padding: '8px', border: 'none', background: 'none', cursor: 'pointer', zIndex: 200 }}
                            aria-label="menu"
                        >
                            {[0, 1, 2].map(i => (
                                <span key={i} style={{
                                    display: 'block', width: 22, height: 2,
                                    background: 'var(--text-primary)', borderRadius: 2,
                                    transition: 'var(--transit)',
                                    transform: menuOpen && i === 0 ? 'rotate(45deg) translate(5px, 5px)'
                                        : menuOpen && i === 1 ? 'scaleX(0)'
                                            : menuOpen && i === 2 ? 'rotate(-45deg) translate(5px, -5px)'
                                                : 'none',
                                }} />
                            ))}
                        </button>
                </div>

                {/* Mobile Menu Overlay */}
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99,

                    background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(20px)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '2.5rem',
                    transform: menuOpen ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
                }}>
                    {['intro', 'board'].map(p => (
                        <button key={p} onClick={() => nav(p)} style={{
                            fontSize: 'var(--t-2xl)', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer',
                            color: page === p ? 'var(--accent)' : 'var(--text-primary)',
                        }}>
                            {t(`nav.${p}`)}
                        </button>
                    ))}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1rem' }}>
                        {LANGS.map(l => (
                            <button key={l.code} onClick={() => i18n.changeLanguage(l.code)} style={{
                                fontWeight: i18n.language === l.code ? 800 : 400,
                                color: i18n.language === l.code ? 'var(--accent)' : 'var(--text-muted)',
                                fontSize: 'var(--t-base)', padding: '0.5rem 1rem', borderRadius: 8,
                                border: i18n.language === l.code ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                                background: 'none', cursor: 'pointer',
                            }}>
                                {l.label}
                            </button>
                        ))}
                    </div>
                    <button
                        className="btn btn-gold"
                        style={{ width: '80%', fontSize: 'var(--t-lg)', marginTop: '1.5rem' }}
                        onClick={() => window.open("https://open.kakao.com/o/sX6Ip2ri")}
                    >
                        {t('hero.cta')}
                    </button>

                    {/* Top spacer */}
                    <div style={{ height: 64 }} />

                </>
                );
};

                export default Header;
