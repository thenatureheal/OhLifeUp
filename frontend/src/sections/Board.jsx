import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const API = "https://ohlifeup.com/api";

const TABS = ['china', 'coaching', 'apply'];
const CAT_BADGE = {
    china: 'badge-blue',
    coaching: 'badge-green',
};

const fmt = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const maskName = (name = '') =>
    name.length <= 1 ? name : name[0] + '*'.repeat(name.length - 1);

// ── List View ──────────────────────────────────────────────────────────────

const ListView = ({ category, onOpen, t }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`${API}/posts?category=${category}`)
            .then(r => r.json())
            .then(setPosts)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [category]);

    const catLabel = (cat) => cat === 'china' ? t('board.china') : t('board.coaching');

    if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('board.loading')}</div>;
    if (posts.length === 0) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('board.empty')}</div>;

    return (
        <>
            {/* Desktop Table */}
            <div className="desktop-only" style={{ overflowX: 'auto' }}>
                <table className="board-table">
                    <thead>
                        <tr>
                            <th className="th-center" style={{ width: 72 }}>{t('board.no')}</th>
                            <th style={{ width: 130 }}>{t('board.category')}</th>
                            <th>{t('board.title')}</th>
                            <th className="th-center" style={{ width: 110 }}>{t('board.author')}</th>
                            <th className="th-center" style={{ width: 110 }}>{t('board.date')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {posts.map((p, i) => (
                            <tr key={p.id} onClick={() => onOpen(p)}>
                                <td className="td-center" style={{ color: 'var(--text-muted)', fontSize: 'var(--t-xs)' }}>{posts.length - i}</td>
                                <td><span className={`badge ${CAT_BADGE[p.category] || 'badge-gold'}`}>{catLabel(p.category)}</span></td>
                                <td className="td-title">{p.title}</td>
                                <td className="td-center">{maskName(p.name)}</td>
                                <td className="td-center" style={{ color: 'var(--text-muted)', fontSize: 'var(--t-xs)' }}>{fmt(p.created_at)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards */}
            <div className="mobile-only" style={{ flexDirection: 'column' }}>
                {posts.map(p => (
                    <div key={p.id} className="board-card" onClick={() => onOpen(p)}>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <span className={`badge ${CAT_BADGE[p.category] || 'badge-gold'}`}>{catLabel(p.category)}</span>
                        </div>
                        <div className="board-card-title">{p.title}</div>
                        <div className="board-card-meta">
                            <span>{maskName(p.name)}</span>
                            <span>{fmt(p.created_at)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

// ── Write View ─────────────────────────────────────────────────────────────

const WriteView = ({ onSuccess, onCancel, t }) => {
    const [form, setForm] = useState({ category: 'china', name: '', password: '', title: '', content: '' });
    const [submitting, setSubmitting] = useState(false);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (res.ok) { onSuccess(); }
        } catch (err) { console.error(err); } finally { setSubmitting(false); }
    };

    return (
        <form onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
                <div className="field">
                    <label>{t('board.name')}</label>
                    <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('board.namePlaceholder')} required />
                </div>
                <div className="field">
                    <label>{t('board.password')}</label>
                    <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder={t('board.passwordPlaceholder')} required minLength={4} />
                </div>
            </div>

            <div className="field" style={{ marginBottom: 'var(--sp-4)' }}>
                <label>{t('board.categoryLabel')}</label>
                <select className="select" value={form.category} onChange={e => set('category', e.target.value)}>
                    <option value="china">{t('board.categoryChina')}</option>
                    <option value="coaching">{t('board.categoryCoaching')}</option>
                </select>
            </div>

            <div className="field" style={{ marginBottom: 'var(--sp-4)' }}>
                <label>{t('board.boardTitle')}</label>
                <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder={t('board.titlePlaceholder')} required />
            </div>

            <div className="field" style={{ marginBottom: 'var(--sp-6)' }}>
                <label>{t('board.content')}</label>
                <textarea className="textarea" value={form.content} onChange={e => set('content', e.target.value)} placeholder={t('board.contentPlaceholder')} required />
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={onCancel}>{t('board.cancel')}</button>
                <button type="submit" className="btn btn-gold" disabled={submitting}>
                    {submitting ? '...' : t('board.submit')}
                </button>
            </div>
        </form>
    );
};

// ── Detail View ────────────────────────────────────────────────────────────

const DetailView = ({ post, onBack, t }) => {
    const catLabel = post.category === 'china' ? t('board.china') : t('board.coaching');
    return (
        <div>
            <div style={{ marginBottom: 'var(--sp-2)' }}>
                <span className={`badge ${CAT_BADGE[post.category] || 'badge-gold'}`}>{catLabel}</span>
            </div>
            <h2 style={{ fontSize: 'var(--t-2xl)', fontWeight: 800, marginBottom: 'var(--sp-3)', lineHeight: 1.2 }}>{post.title}</h2>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: 'var(--t-xs)', color: 'var(--text-muted)', marginBottom: 'var(--sp-6)', paddingBottom: 'var(--sp-4)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <span>{post.name}</span><span>{fmt(post.created_at)}</span>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 'var(--t-base)', lineHeight: 1.8, color: 'var(--text-secondary)', minHeight: 200 }}>{post.content}</pre>
            <div style={{ marginTop: 'var(--sp-8)', borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-4)' }}>
                <button className="btn btn-outline" onClick={onBack}>{t('board.back')}</button>
            </div>
        </div>
    );
};

// ── Board (Main) ───────────────────────────────────────────────────────────

const Board = () => {
    const { t } = useTranslation();
    const [tab, setTab] = useState('china'); // 'china' | 'coaching' | 'apply'
    const [view, setView] = useState('list'); // 'list' | 'write' | 'detail'
    const [selected, setSelected] = useState(null);

    const openPost = (p) => { setSelected(p); setView('detail'); window.scrollTo({ top: 0 }); };
    const backToList = () => { setSelected(null); setView('list'); };
    const handleSuccess = () => { setTab(tab === 'apply' ? 'china' : tab); setView('list'); window.scrollTo({ top: 0 }); };

    const tabLabel = (k) => ({
        china: t('board.china'),
        coaching: t('board.coaching'),
        apply: t('board.apply'),
    }[k]);

    return (
        <section style={{ minHeight: 'calc(100vh - 64px)', paddingTop: 'var(--sp-8)', paddingBottom: 'var(--sp-section)' }}>
            <div className="wrap">

                {/* Tabs */}
                {view === 'list' && (
                    <nav style={{
                        display: 'flex', gap: 0,
                        borderBottom: '2px solid var(--border)',
                        marginBottom: 'var(--sp-6)',
                        flexWrap: 'wrap',
                    }}>
                        {TABS.map(k => (
                            <button key={k} onClick={() => setTab(k)} style={{
                                padding: '0.85rem 1.5rem',
                                fontSize: 'var(--t-sm)', fontWeight: tab === k ? 800 : 500,
                                color: tab === k ? 'var(--accent)' : 'var(--text-secondary)',
                                background: 'none', border: 'none', cursor: 'pointer',
                                borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent',
                                marginBottom: -2, transition: 'var(--transit)',
                                whiteSpace: 'nowrap',
                            }}>
                                {tabLabel(k)}
                            </button>
                        ))}

                        {/* Desktop: Write button inline */}
                        {tab !== 'apply' && (
                            <button className="desktop-only btn btn-gold" style={{ marginLeft: 'auto', marginBottom: 4, padding: '0.55rem 1.25rem', fontSize: 'var(--t-xs)' }} onClick={() => setView('write')}>
                                {t('board.writeBtn')}
                            </button>
                        )}
                    </nav>
                )}

                {/* Breadcrumb for detail/write */}
                {(view === 'write' || view === 'detail') && (
                    <div style={{ marginBottom: 'var(--sp-4)', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: 'var(--t-xs)', color: 'var(--text-muted)' }}>
                        <button className="btn-ghost" style={{ padding: 0, fontSize: 'var(--t-xs)' }} onClick={backToList}>← {t('board.back')}</button>
                    </div>
                )}

                {/* Panel */}
                <div style={{
                    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
                    overflow: 'hidden',
                }} className="fade-in">

                    {view === 'list' && tab !== 'apply' && (
                        <>
                            <ListView category={tab} onOpen={openPost} t={t} />
                            {/* Mobile: Write button at bottom */}
                            <div className="mobile-only" style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
                                <button className="btn btn-gold" style={{ width: '100%' }} onClick={() => setView('write')}>
                                    {t('board.writeBtn')}
                                </button>
                            </div>
                        </>
                    )}

                    {(view === 'list' && tab === 'apply') || view === 'write' ? (
                        <div style={{ padding: 'var(--sp-6)' }}>
                            <h2 style={{ fontSize: 'var(--t-2xl)', fontWeight: 800, marginBottom: 'var(--sp-6)' }}>{t('board.apply')}</h2>
                            <WriteView onSuccess={handleSuccess} onCancel={backToList} t={t} />
                        </div>
                    ) : null}

                    {view === 'detail' && selected && (
                        <div style={{ padding: 'var(--sp-6)' }}>
                            <DetailView post={selected} onBack={backToList} t={t} />
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default Board;
