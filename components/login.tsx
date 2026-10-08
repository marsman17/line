"use client";
import { LanguageSelector, usePreferences } from "./preferences";
import { useState } from "react";
import { ArrowRight, LockKeyhole, UtensilsCrossed } from "lucide-react";
import { api } from "../lib/client";
export function LoginForm({ cms = false }: { cms?: boolean }) {
  const { t: tx, locale, n } = usePreferences();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <div className="login-story">
        <a className="brand" href="/check-in">
          <span className="brand-icon">
            {tx("T")}
            <span>{tx("Q")}</span>
          </span>
          {tx("TableQ")}
          <span className="brand-dot">.</span>
        </a>
        <div>
          <span className="eyebrow">
            {tx("A BETTER WAIT. A WARMER WELCOME.")}
          </span>
          <h1>
            {tx("Great evenings")}
            <br />
            {tx("start at the door.")}
          </h1>
          <p>
            {tx("A little less waiting.")}
            <br />
            {tx("A lot more hospitality.")}
          </p>
          <div className="login-art">
            <UtensilsCrossed size={72} />
            <span className="orbit one" />
            <span className="orbit two" />
          </div>
        </div>
        <small>{tx("Built for the people behind every great table.")}</small>
      </div>
      <section className="login-form">
        <div className="login-card">
          <LanguageSelector />
          <span className="icon-tile">
            <LockKeyhole size={22} />
          </span>
          <h2>{cms ? tx("CMS sign in") : tx("Welcome back.")}</h2>
          <p>
            {cms
              ? tx(
                  "Sign in as an administrator to manage accounts and branches.",
                )
              : tx("Sign in to manage your restaurant’s queue.")}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("login", "POST", { email, password });
                window.location.href = cms ? "/cms" : "/";
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            <label>
              {tx("Email address")}
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tx("you@restaurant.com")}
                required
              />
            </label>
            <label>
              {tx("Password")}
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tx("Your password")}
                required
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {tx(error)}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? tx("Signing in…") : tx("Sign in")}
              <ArrowRight size={17} />
            </button>
          </form>
          <a className="muted-link" href="/check-in">
            {tx("Joining the queue? Guest check-in →")}
          </a>
          {process.env.NODE_ENV === "development" && (
            <p className="dev-note">
              {tx("Local development: admin@tableq.local / tableq-dev-only")}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export default function Login() {
  return <LoginForm />;
}
