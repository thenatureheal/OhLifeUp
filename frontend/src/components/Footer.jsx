import React from 'react';
import { useTranslation } from 'react-i18next';

const Footer = () => {
    const { t } = useTranslation();
    return (
        <footer style={{ background: '#0a0a0f', color: '#fff', paddingBlock: 'var(--sp-12)' }}>
            <div className="wrap">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 'var(--sp-8)', marginBottom: 'var(--sp-8)' }}>
                    <div>
                        <div style={{ fontSize: 'var(--t-xl)', fontWeight: 900, letterSpacing: '-0.05em', marginBottom: 'var(--sp-3)' }}>
                            Oh<span style={{ color: 'var(--accent)' }}>LifeUp</span>
                        </div>
                        <p style={{ color: '#8f8fa5', fontSize: 'var(--t-sm)', lineHeight: 1.8 }}>{t('footer.tagline')}</p>
                    </div>
                    <div>
                        <div style={{ fontSize: 'var(--t-xs)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 'var(--sp-3)' }}>
                            {t('footer.contact')}
                        </div>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', color: '#8f8fa5', fontSize: 'var(--t-sm)' }}>
                            <li>010-0000-0000</li>
                            <li>help@ohlifeup.com</li>
                            <li>{t('footer.hours')}</li>
                        </ul>
                    </div>
                    <div>
                        <div style={{ fontSize: 'var(--t-xs)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 'var(--sp-3)' }}>
                            Hubs
                        </div>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', color: '#8f8fa5', fontSize: 'var(--t-sm)' }}>
                            <li>위해 물류센터 (Weihai)</li>
                            <li>광저우 분소 (Guangzhou)</li>
                        </ul>
                    </div>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--sp-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: 'var(--t-xs)', color: '#4a4a5a' }}>© 2026 OhLifeUp. {t('footer.rights')}</span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
