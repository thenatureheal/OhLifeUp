import React from 'react';
import { useTranslation } from 'react-i18next';

const Hero = ({ setPage }) => {
    const { t } = useTranslation();
    return (
        <section style={{
            minHeight: 'clamp(540px, 88vh, 1000px)',
            display: 'flex', alignItems: 'center',
            position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(160deg, #ffffff 0%, #f7f7f9 100%)',
        }}>
            {/* Decorative gold blob */}
            <div style={{
                position: 'absolute', right: '5%', top: '15%',
                width: 'clamp(320px, 45vw, 720px)', height: 'clamp(320px, 45vw, 720px)',
                background: 'radial-gradient(circle, rgba(201,168,76,0.09) 0%, transparent 70%)',
                borderRadius: '50%', pointerEvents: 'none', userSelect: 'none',
            }} />

            <div className="wrap">
                <div style={{ maxWidth: 740 }} className="fade-up">
                    <span className="badge badge-gold" style={{ marginBottom: 'var(--sp-4)' }}>
                        <span style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} />
                        {t('hero.badge')}
                    </span>

                    <h1 className="h1" style={{ marginBottom: 'var(--sp-3)' }}>
                        {t('hero.title1')}<br />
                        <span style={{ color: 'var(--accent)' }}>{t('hero.title2')}</span>
                    </h1>

                    <div className="divider" style={{ marginBottom: 'var(--sp-4)' }} />

                    <p className="body-lg" style={{ maxWidth: 560, marginBottom: 'var(--sp-6)' }}>
                        {t('hero.subtitle')}
                    </p>

                    <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                        <button onClick={() => window.open("https://open.kakao.com/o/sX6Ip2ri")}>
                            {t('hero.cta')}
                        </button>


                        <button className="btn btn-outline" onClick={() => {
                            document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
                        }}>
                            {t('hero.ctaSecondary')}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
