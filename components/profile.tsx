"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, Leaf, Check } from "lucide-react";
import { api } from "../lib/client";
import type { Account } from "../lib/account";
import { usePreferences, AccountAvatar } from "./preferences";
import { languageNames, type Language } from "../lib/translations";
import AccountMenu from "./account-menu";
import { Modal } from "./modal";
const countries = [
  ["US", "1"],
  ["PK", "92"],
  ["GB", "44"],
  ["IN", "91"],
  ["BR", "55"],
  ["ES", "34"],
  ["PT", "351"],
  ["DE", "49"],
  ["FR", "33"],
  ["IT", "39"],
  ["CA", "1"],
  ["AU", "61"],
  ["AE", "971"],
] as const;
export default function Profile() {
  const { user, update, setUser, t } = usePreferences();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [country, setCountry] = useState("US");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  useEffect(() => {
    api<Account>("account")
      .then((u) => {
        setUser(u);
        setName(u.name);
        setLanguage(u.language);
        const match = [...countries]
          .sort((a, b) => b[1].length - a[1].length)
          .find((v) => u.phone.startsWith("+" + v[1]));
        if (match) {
          setCountry(match[0]);
          setPhone(u.phone.slice(match[1].length + 1));
        }
        setLoaded(true);
      })
      .catch(() => window.location.replace("/login"));
  }, []);
  useEffect(() => {
    if (user) setLanguage(user.language);
  }, [user?.language]);
  const dial = countries.find((c) => c[0] === country)![1];
  const fullPhone = phone.startsWith("+")
    ? phone.replace(/[\s()-]/g, "")
    : "+" + dial + phone.replace(/\D/g, "");
  async function action(fn: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(t(success));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!loaded || !user)
    return (
      <main className="profile-page">
        <p>Loading profile…</p>
      </main>
    );
  return (
    <div className="profile-shell">
      <header className="profile-header">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          TableQ
        </a>
        <a className="button secondary" href="/">
          <ArrowLeft size={16} />
          {t("Back to workspace")}
        </a>
        <AccountMenu />
      </header>
      <main className="profile-page">
        <h1>{t("Profile")}</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              await update({ name, language });
            }, "Changes saved.");
          }}
        >
          <section className="profile-card">
            <div className="picture-field">
              <strong>{t("Profile picture")}</strong>
              <AccountAvatar user={user} size="large" />
              <label className="button secondary upload-picture">
                {t("Upload picture")}
                <input
                  aria-label={t("Upload picture")}
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    void action(async () => {
                      if (!["image/png", "image/jpeg"].includes(file.type))
                        throw Error("Choose a PNG or JPG picture.");
                      if (file.size > 2097152)
                        throw Error("Picture must be no larger than 2 MB.");
                      const res = await fetch("/api/account/avatar", {
                        method: "POST",
                        headers: { "Content-Type": file.type },
                        body: file,
                      });
                      const data = await res.json();
                      if (!res.ok) throw Error(data.error);
                      setUser(data);
                    }, "Picture saved.");
                  }}
                />
              </label>
              <small>{t("PNG/JPG, square recommended. Max 2 MB.")}</small>
            </div>
            <label className="profile-field">
              {t("Name")}
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="profile-field">
              {t("Language")}
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                {Object.entries(languageNames).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="profile-field">
              {t("Email")}
              <input
                aria-label={t("Email")}
                disabled
                value={user.email}
                readOnly
              />
              <small>{t("Your email address cannot be changed.")}</small>
            </label>
            <div className="profile-field">
              <label htmlFor="profile-phone">{t("Phone number")}</label>
              <div className="phone-row">
                <select
                  aria-label={t("Country")}
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setSent(false);
                  }}
                >
                  {countries.map(([region, dial]) => (
                    <option key={region} value={region}>
                      {new Intl.DisplayNames([user.language], {
                        type: "region",
                      }).of(region)}{" "}
                      +{dial}
                    </option>
                  ))}
                </select>
                <input
                  id="profile-phone"
                  type="tel"
                  autoComplete="tel-national"
                  placeholder={t("Phone number")}
                  value={phone}
                  maxLength={24}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setSent(false);
                  }}
                />
                <button
                  type="button"
                  className="button secondary"
                  disabled={
                    busy ||
                    !user.smsEnabled ||
                    !/^\+[1-9]\d{7,14}$/.test(fullPhone)
                  }
                  onClick={() =>
                    void action(async () => {
                      await api("account/phone/send", "POST", {
                        phone: fullPhone,
                      });
                      setSent(true);
                    }, "Code sent. It expires in 10 minutes.")
                  }
                >
                  {t("Send verification code")}
                </button>
              </div>
              {fullPhone !== user.phone && phone && (
                <small>
                  {t("Verify a new number before it can be saved.")}
                </small>
              )}
              {!user.smsEnabled && (
                <small>
                  {t(
                    "Phone verification is unavailable until SMS delivery is configured.",
                  )}
                </small>
              )}
              {user.phone_verified_at && fullPhone === user.phone && (
                <small className="phone-verified">
                  <Check size={15} />
                  {t("Verified")}
                </small>
              )}
              {sent && (
                <div className="verification-row">
                  <label>
                    {t("Verification code")}
                    <input
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      value={code}
                      maxLength={6}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="button primary"
                    disabled={busy || code.length !== 6}
                    onClick={() =>
                      void action(async () => {
                        setUser(
                          await api<Account>("account/phone/verify", "POST", {
                            code,
                          }),
                        );
                        setSent(false);
                        setCode("");
                      }, "Phone verified.")
                    }
                  >
                    {t("Verify")}
                  </button>
                </div>
              )}
            </div>
          </section>
          {error && (
            <p role="alert" className="account-error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="profile-message">
              {message}
            </p>
          )}
          <div className="profile-save-row">
            <button className="button primary" disabled={busy || !name.trim()}>
              {t(busy ? "Saving…" : "Save changes")}
            </button>
            <button
              type="button"
              className="button danger"
              disabled={!user.canDelete || busy}
              onClick={() => {
                setDeleting(true);
                setPassword("");
                setError("");
              }}
            >
              {t("Delete account")}
            </button>
          </div>
          {!user.canDelete && (
            <p className="delete-help">
              {t("Create another administrator before deleting this account.")}
            </p>
          )}
        </form>
      </main>
      {deleting && (
        <Modal
          title={t("Delete account")}
          onClose={() => {
            if (!busy) setDeleting(false);
          }}
        >
          <form
            className="delete-form"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                await api("account", "DELETE", { password });
                window.location.href = "/login";
              }, "");
            }}
          >
            <p>
              {t(
                "This permanently removes your account, sessions, picture, and feedback. Restaurant queues and customers remain. Enter your password to continue.",
              )}
            </p>
            <label className="profile-field">
              {t("Password")}
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="account-error">
                {error}
              </p>
            )}
            <div className="account-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setDeleting(false)}
              >
                {t("Cancel")}
              </button>
              <button className="button danger" disabled={busy || !password}>
                {t("Delete account")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
