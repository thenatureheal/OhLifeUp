"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isFirebaseConfigured } from "@/lib/firebase";
import { createInquiry } from "@/lib/inquiries";
import { createNotification } from "@/lib/notifications";

type Status = "idle" | "submitting" | "success" | "error";

export default function InquiryForm() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    message: "",
  });
  const [status, setStatus] = useState<Status>("idle");

  const setField = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const canSubmit =
    form.name.trim().length > 0 && form.message.trim().length > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !isFirebaseConfigured) return;
    setStatus("submitting");
    try {
      const id = await createInquiry(form);
      // Record an admin notification (best-effort; failure shouldn't block).
      try {
        await createNotification(
          "inquiry",
          `${t("contact.notifyTitle")}: ${form.name.trim()}`,
          form.message.trim().slice(0, 120),
          id
        );
      } catch (err) {
        console.error("inquiry notification failed", err);
      }
      setForm({ name: "", phone: "", email: "", message: "" });
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <section id="contact" className="section border-t border-border">
      <div className="wrap-narrow">
        <div className="text-center">
          <span className="label text-accent">{t("contact.label")}</span>
          <h2 className="h2 mt-2">{t("contact.title")}</h2>
          <p className="body-lg mx-auto mt-3 max-w-xl">
            {t("contact.subtitle")}
          </p>
          <div className="divider mx-auto" />
        </div>

        <div className="card mt-10">
          {status === "success" ? (
            <div className="py-6 text-center">
              <p className="text-3xl">✅</p>
              <p className="mt-3 font-bold text-text-primary">
                {t("contact.successTitle")}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                {t("contact.successMsg")}
              </p>
              <button
                className="btn btn-outline mt-6"
                onClick={() => setStatus("idle")}
              >
                {t("contact.writeAgain")}
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="field">
                <label>
                  {t("contact.nameLabel")}{" "}
                  <span className="text-accent">*</span>
                </label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder={t("contact.namePlaceholder")}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="field">
                  <label>{t("contact.phoneLabel")}</label>
                  <input
                    className="input"
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder={t("contact.phonePlaceholder")}
                  />
                </div>
                <div className="field">
                  <label>{t("contact.emailLabel")}</label>
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder={t("contact.emailPlaceholder")}
                  />
                </div>
              </div>

              <div className="field">
                <label>
                  {t("contact.messageLabel")}{" "}
                  <span className="text-accent">*</span>
                </label>
                <textarea
                  className="textarea"
                  value={form.message}
                  onChange={(e) => setField("message", e.target.value)}
                  placeholder={t("contact.messagePlaceholder")}
                  required
                />
              </div>

              {!isFirebaseConfigured && (
                <p className="text-sm text-text-muted">
                  {t("contact.notConfigured")}
                </p>
              )}
              {status === "error" && (
                <p className="text-sm text-red-600">{t("contact.error")}</p>
              )}

              <button
                type="submit"
                className="btn btn-gold w-full"
                disabled={
                  !canSubmit ||
                  status === "submitting" ||
                  !isFirebaseConfigured
                }
              >
                {status === "submitting"
                  ? t("contact.submitting")
                  : t("contact.submit")}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
