import React from 'react';
import { useTranslation } from 'react-i18next';

const CARDS = [
    { key: 'card1', icon: '🇨🇳' },
    { key: 'card2', icon: '✨' },
    { key: 'card3', icon: '📊' },
    { key: 'card4', icon: '⚡' },
];

const About = () => {
    const { t } = useTranslation();
    return (
        <section id="about" className="section" style={{ background: 'var(--bg-alt)' }}>
            <div className="wrap">
                <div style={{ marginBottom: 'var(--sp-8)', maxWidth: 620 }} className="fade-up">
                    <span className="label" style={{ color: 'var(--accent)', display: 'block', marginBottom: 'var(--sp-2)' }}>OhLifeUp</span>
                    <h2 className="h2" style={{ marginBottom: 'var(--sp-3)' }}>{t('about.title')}</h2>
                    <div className="divider" style={{ marginBottom: 'var(--sp-4)' }} />
                    <p className="body-lg">{t('about.subtitle')}</p>
                </div>

                <div className="grid-auto fade-up" style={{ '--gi': '280px' }}>
                    {CARDS.map(({ key, icon }) => (
                        <div key={key} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                            <div style={{ fontSize: '2rem', lineHeight: 1 }}>{icon}</div>
                            <h3 className="h3">{t(`about.${key}Title`)}</h3>
                            <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{t(`about.${key}Desc`)}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default About;
