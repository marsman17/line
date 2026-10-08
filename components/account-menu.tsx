"use client";
import { useState, useEffect, useRef } from "react";
import {
  Languages,
  Sun,
  Moon,
  Monitor,
  LifeBuoy,
  User,
  LogOut,
  ChevronRight,
  ChevronDown,
  Check,
} from "lucide-react";
import { api } from "../lib/client";
import { usePreferences, AccountAvatar } from "./preferences";
import { languageNames, type Language } from "../lib/translations";
import { Modal } from "./modal";
const categories = {
  general: "General feedback or support",
  feature: "Feature Request",
  billing: "Billing/Payment issue",
  performance: "Performance Problems",
};
export default function AccountMenu() {
  const { user, update, t } = usePreferences();
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState("");
  const [support, setSupport] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setSubmenu("");
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSubmenu("");
        ref.current
          ?.querySelector<HTMLButtonElement>(".account-trigger")
          ?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);
  async function save(data: Parameters<typeof update>[0]) {
    setBusy(true);
    setError("");
    try {
      await update(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!user) return null;
  return (
    <>
      <div className="account-menu" ref={ref}>
        <button
          className="account-trigger"
          aria-label={t("Account menu")}
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
            setSubmenu("");
          }}
        >
          <AccountAvatar user={user} />
          <strong>{user.name}</strong>
          <ChevronDown size={16} />
        </button>
        {open && (
          <div className="account-popover">
            <div className="account-identity">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button
              aria-expanded={submenu === "language"}
              onClick={() =>
                setSubmenu(submenu === "language" ? "" : "language")
              }
            >
              <Languages size={19} />
              {t("Language")}
              <ChevronRight size={17} />
            </button>
            {submenu === "language" && (
              <div className="account-submenu" aria-label={t("Language")}>
                {Object.entries(languageNames).map(([code, name]) => (
                  <button
                    disabled={busy}
                    key={code}
                    onClick={() => void save({ language: code as Language })}
                  >
                    {name}
                    {user.language === code && <Check size={17} />}
                  </button>
                ))}
              </div>
            )}
            <button
              aria-expanded={submenu === "theme"}
              onClick={() => setSubmenu(submenu === "theme" ? "" : "theme")}
            >
              <Sun size={19} />
              {t("Theme")}
              <ChevronRight size={17} />
            </button>
            {submenu === "theme" && (
              <div className="account-submenu" aria-label={t("Theme")}>
                {(
                  [
                    ["light", "Light", Sun],
                    ["dark", "Dark", Moon],
                    ["system", "System", Monitor],
                  ] as const
                ).map(([mode, name, Icon]) => (
                  <button
                    disabled={busy}
                    key={mode}
                    onClick={() => void save({ theme: mode })}
                  >
                    <Icon size={18} />
                    {t(name)}
                    {user.theme === mode && <Check size={17} />}
                  </button>
                ))}
              </div>
            )}
            <div className="account-divider" />
            <button
              onClick={() => {
                setSupport(true);
                setOpen(false);
              }}
            >
              <LifeBuoy size={19} />
              {t("Contact support")}
            </button>
            <div className="account-divider" />
            {user.role === "admin" && (
              <a href="/cms">
                <User size={19} />
                CMS administration
              </a>
            )}
            <a href="/profile">
              <User size={19} />
              {t("Profile")}
            </a>
            <button
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await api("logout", "POST");
                  window.location.href = "/login";
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut size={19} />
              {t("Log out")}
            </button>
            {error && (
              <p role="alert" className="account-error">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
      {support && <Support onClose={() => setSupport(false)} />}
    </>
  );
}
function Support({ onClose }: { onClose: () => void }) {
  const { user, t } = usePreferences();
  const [category, setCategory] = useState("general");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [inbox, setInbox] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const load = async () => {
    try {
      setItems((await api("feedback")).items);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal
      title={t("Submit feedback")}
      onClose={onClose}
      className="feedback-dialog"
    >
      <div className="feedback-tabs">
        <button
          className={!inbox ? "active" : ""}
          onClick={() => setInbox(false)}
        >
          {t("Submit feedback")}
        </button>
        <button
          className={inbox ? "active" : ""}
          onClick={() => {
            setInbox(true);
            void load();
          }}
        >
          {t(user?.role === "admin" ? "Workspace feedback" : "My messages")}
        </button>
      </div>
      {inbox ? (
        <div className="feedback-inbox">
          {!items.length && <p>{t("No messages yet.")}</p>}
          {items.map((item) => (
            <article key={item.id}>
              <strong>
                {t(categories[item.category as keyof typeof categories])}
              </strong>
              <small>
                {item.name || item.email} ·{" "}
                {new Date(item.created_at).toLocaleString(user?.language)}
              </small>
              <p>{item.comment}</p>
              <span>{t(item.resolved ? "Resolved" : "Open")}</span>
              {user?.role === "admin" && (
                <button
                  className="button secondary"
                  onClick={async () => {
                    try {
                      await api(`feedback/${item.id}`, "PATCH", {
                        resolved: !item.resolved,
                      });
                      await load();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {t(item.resolved ? "Reopen" : "Mark resolved")}
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setMessage("");
            try {
              await api("feedback", "POST", { category, comment });
              setComment("");
              setMessage(t("Feedback saved for workspace administrators."));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="feedback-body">
            <fieldset>
              <legend>{t("Category")}</legend>
              {Object.entries(categories).map(([key, name]) => (
                <label key={key}>
                  <input
                    type="radio"
                    name="category"
                    value={key}
                    checked={category === key}
                    onChange={() => setCategory(key)}
                  />
                  {t(name)}
                </label>
              ))}
            </fieldset>
            <label className="profile-field">
              {t("Comment")}
              <textarea
                required
                maxLength={4000}
                placeholder={t("Tell us more…")}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
            {message && <p role="status">{message}</p>}
          </div>
          <footer className="account-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              {t("Cancel")}
            </button>
            <button
              className="button primary"
              disabled={busy || !comment.trim()}
            >
              {t("Send message")}
            </button>
          </footer>
        </form>
      )}
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
