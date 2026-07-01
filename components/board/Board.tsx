"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listPosts, createPost, type Post, type Category } from "@/lib/posts";
import { isFirebaseConfigured } from "@/lib/firebase";
import { fmtDate, maskName } from "@/lib/format";

type Tab = Category | "apply";
type View = "list" | "write" | "detail";

const TABS: Tab[] = ["china", "coaching", "apply"];
const CAT_BADGE: Record<Category, string> = {
  china: "badge-blue",
  coaching: "badge-green",
};

function ConfigNotice() {
  return (
    <div className="p-12 text-center text-sm text-text-muted">
      Firebase가 아직 설정되지 않았습니다. <br />
      <code className="text-xs">.env.local</code> 에 <code className="text-xs">NEXT_PUBLIC_FIREBASE_*</code> 값을
      채우면 게시판이 동작합니다.
    </div>
  );
}

// ── List ─────────────────────────────────────────────────────────
function ListView({
  category,
  onOpen,
}: {
  category: Category;
  onOpen: (p: Post) => void;
}) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    listPosts(category)
      .then((data) => active && setPosts(data))
      .catch((err) => console.error(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [category]);

  const catLabel = (cat: Category) =>
    cat === "china" ? t("board.china") : t("board.coaching");

  if (!isFirebaseConfigured) return <ConfigNotice />;
  if (loading)
    return <div className="p-16 text-center text-text-muted">{t("board.loading")}</div>;
  if (posts.length === 0)
    return <div className="p-16 text-center text-text-muted">{t("board.empty")}</div>;

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="board-table">
          <thead>
            <tr>
              <th className="th-center w-[72px]">{t("board.no")}</th>
              <th className="w-[130px]">{t("board.category")}</th>
              <th>{t("board.title")}</th>
              <th className="th-center w-[110px]">{t("board.author")}</th>
              <th className="th-center w-[110px]">{t("board.date")}</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p, i) => (
              <tr key={p.id} onClick={() => onOpen(p)}>
                <td className="td-center text-xs">{posts.length - i}</td>
                <td>
                  <span className={`badge ${CAT_BADGE[p.category] ?? "badge-gold"}`}>
                    {catLabel(p.category)}
                  </span>
                </td>
                <td className="td-title">{p.title}</td>
                <td className="td-center">{maskName(p.name)}</td>
                <td className="td-center text-xs">{fmtDate(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col lg:hidden">
        {posts.map((p) => (
          <div key={p.id} className="board-card" onClick={() => onOpen(p)}>
            <div className="mb-2">
              <span className={`badge ${CAT_BADGE[p.category] ?? "badge-gold"}`}>
                {catLabel(p.category)}
              </span>
            </div>
            <div className="board-card-title">{p.title}</div>
            <div className="board-card-meta">
              <span>{maskName(p.name)}</span>
              <span>{fmtDate(p.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Write ────────────────────────────────────────────────────────
function WriteView({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    category: "china" as Category,
    name: "",
    password: "",
    title: "",
    content: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }) as typeof form);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured) {
      setError(true);
      return;
    }
    setSubmitting(true);
    setError(false);
    try {
      // password is collected for UX parity but intentionally not persisted.
      await createPost({
        category: form.category,
        name: form.name,
        title: form.title,
        content: form.content,
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label>{t("board.name")}</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t("board.namePlaceholder")}
            required
          />
        </div>
        <div className="field">
          <label>{t("board.password")}</label>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder={t("board.passwordPlaceholder")}
            required
            minLength={4}
          />
        </div>
      </div>

      <div className="field mb-4">
        <label>{t("board.categoryLabel")}</label>
        <select
          className="select"
          value={form.category}
          onChange={(e) => set("category", e.target.value)}
        >
          <option value="china">{t("board.categoryChina")}</option>
          <option value="coaching">{t("board.categoryCoaching")}</option>
        </select>
      </div>

      <div className="field mb-4">
        <label>{t("board.boardTitle")}</label>
        <input
          className="input"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder={t("board.titlePlaceholder")}
          required
        />
      </div>

      <div className="field mb-6">
        <label>{t("board.content")}</label>
        <textarea
          className="textarea"
          value={form.content}
          onChange={(e) => set("content", e.target.value)}
          placeholder={t("board.contentPlaceholder")}
          required
        />
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600">{t("board.error")}</p>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          {t("board.cancel")}
        </button>
        <button type="submit" className="btn btn-gold" disabled={submitting}>
          {submitting ? t("board.submitting") : t("board.submit")}
        </button>
      </div>
    </form>
  );
}

// ── Detail ───────────────────────────────────────────────────────
function DetailView({ post, onBack }: { post: Post; onBack: () => void }) {
  const { t } = useTranslation();
  const catLabel =
    post.category === "china" ? t("board.china") : t("board.coaching");
  return (
    <div>
      <div className="mb-2">
        <span className={`badge ${CAT_BADGE[post.category] ?? "badge-gold"}`}>
          {catLabel}
        </span>
      </div>
      <h2 className="text-2xl font-extrabold leading-tight">{post.title}</h2>
      <div className="mt-3 flex flex-wrap gap-6 border-b border-border pb-4 text-xs text-text-muted">
        <span>{post.name}</span>
        <span>{fmtDate(post.createdAt)}</span>
      </div>
      <pre className="mt-6 min-h-[200px] whitespace-pre-wrap font-sans text-base leading-loose text-text-secondary">
        {post.content}
      </pre>
      <div className="mt-8 border-t border-border pt-4">
        <button className="btn btn-outline" onClick={onBack}>
          {t("board.back")}
        </button>
      </div>
    </div>
  );
}

// ── Board (main) ─────────────────────────────────────────────────
export default function Board() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("china");
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<Post | null>(null);

  const openPost = (p: Post) => {
    setSelected(p);
    setView("detail");
    window.scrollTo({ top: 0 });
  };
  const backToList = () => {
    setSelected(null);
    setView("list");
  };
  const handleSuccess = () => {
    setTab(tab === "apply" ? "china" : tab);
    setView("list");
    window.scrollTo({ top: 0 });
  };

  const tabLabel = (k: Tab) =>
    ({
      china: t("board.china"),
      coaching: t("board.coaching"),
      apply: t("board.apply"),
    })[k];

  return (
    <section className="min-h-[calc(100vh-64px)] pb-[clamp(4rem,10vw,10rem)] pt-8">
      <div className="wrap">
        {/* Tabs */}
        {view === "list" && (
          <nav className="mb-6 flex flex-wrap items-center border-b-2 border-border">
            {TABS.map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`-mb-0.5 whitespace-nowrap border-b-2 px-6 py-3 text-sm transition-colors ${
                  tab === k
                    ? "border-accent font-extrabold text-accent"
                    : "border-transparent font-medium text-text-secondary"
                }`}
              >
                {tabLabel(k)}
              </button>
            ))}

            {tab !== "apply" && (
              <button
                className="btn btn-gold ml-auto hidden px-5 py-2 text-xs lg:inline-flex"
                onClick={() => setView("write")}
              >
                {t("board.writeBtn")}
              </button>
            )}
          </nav>
        )}

        {/* Breadcrumb */}
        {(view === "write" || view === "detail") && (
          <div className="mb-4 flex items-center gap-2 text-xs text-text-muted">
            <button className="btn-ghost p-0 text-xs" onClick={backToList}>
              ← {t("board.back")}
            </button>
          </div>
        )}

        {/* Panel */}
        <div className="animate-fade-in overflow-hidden rounded-lg border border-border bg-bg-card shadow-soft">
          {view === "list" && tab !== "apply" && (
            <>
              <ListView category={tab} onOpen={openPost} />
              <div className="border-t border-border p-4 lg:hidden">
                <button
                  className="btn btn-gold w-full"
                  onClick={() => setView("write")}
                >
                  {t("board.writeBtn")}
                </button>
              </div>
            </>
          )}

          {((view === "list" && tab === "apply") || view === "write") && (
            <div className="p-6">
              <h2 className="mb-6 text-2xl font-extrabold">{t("board.apply")}</h2>
              <WriteView onSuccess={handleSuccess} onCancel={backToList} />
            </div>
          )}

          {view === "detail" && selected && (
            <div className="p-6">
              <DetailView post={selected} onBack={backToList} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
