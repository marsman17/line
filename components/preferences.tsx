"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { Account } from "../lib/account";
import { api } from "../lib/client";
import {
  translate,
  number,
  localeFor,
  supportedLanguages,
  languageNames,
  type Language,
  type Parameters,
} from "../lib/translations";
import { appearance } from "../lib/appearance";
type Settings = Partial<
  Pick<Account, "name" | "language" | "theme" | "accent">
>;
const Context = createContext<{
  user: Account | null;
  refresh: () => Promise<void>;
  update: (data: Settings) => Promise<Account>;
  setUser: (u: Account) => void;
  language: Language;
  locale: string;
  setLanguage: (l: Language) => Promise<void>;
  n: (v: number) => string;
  t: (s: string, p?: Parameters) => string;
}>({
  user: null,
  refresh: async () => {},
  update: async () => {
    throw Error("Not ready");
  },
  setUser: () => {},
  language: "en",
  locale: "en",
  setLanguage: async () => {},
  n: (v) => String(v),
  t: (s, p) => translate("en", s, p),
});
export function Preferences({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [publicLanguage, setPublicLanguage] = useState<Language>("en");
  const refresh = useCallback(async () => {
    try {
      setUser(await api<Account>("account"));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      const value = localStorage.getItem("tableq-language") as Language;
      if (supportedLanguages.includes(value)) setPublicLanguage(value);
    } catch {}
    void refresh();
  }, [refresh]);
  const language = user?.language || publicLanguage;
  useEffect(() => {
    try {
      localStorage.setItem("tableq-language", language);
    } catch {}
  }, [language]);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme =
        user?.theme === "system"
          ? mq.matches
            ? "dark"
            : "light"
          : user?.theme || "dark";
      const root = document.documentElement;
      root.dataset.theme = theme;
      root.lang = language;
      root.dir = language === "ur" ? "rtl" : "ltr";
      const colors = appearance(user?.accent || "#f2aa35", theme === "dark");
      root.style.setProperty("--accent", colors.accent);
      root.style.setProperty("--accent-text", colors.onAccent);
      root.style.setProperty("--amber", colors.ink);
      root.style.setProperty(
        "--amber-dim",
        `color-mix(in srgb, ${colors.accent} 16%, transparent)`,
      );
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [user, language]);
  const update = async (data: Settings) => {
    const result = await api<Account>("account", "PATCH", data);
    setUser(result);
    return result;
  };
  const setLanguage = async (value: Language) => {
    if (user) await update({ language: value });
    else setPublicLanguage(value);
  };
  return (
    <Context.Provider
      value={{
        user,
        refresh,
        update,
        setUser,
        language,
        locale: localeFor(language),
        setLanguage,
        n: (value) => number(language, value),
        t: (s, p) => translate(language, s, p),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
export function LanguageSelector() {
  const { language, setLanguage, t } = usePreferences();
  const [error, setError] = useState("");
  return (
    <div className="language-control">
      <select
        aria-label={t("Language")}
        value={language}
        onChange={(e) => {
          setError("");
          void setLanguage(e.target.value as Language).catch(() =>
            setError(t("Could not save language.")),
          );
        }}
      >
        {Object.entries(languageNames).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
export function AccountAvatar({
  user,
  size = "",
}: {
  user: Account;
  size?: string;
}) {
  return (
    <span className={`avatar account-avatar ${size}`}>
      {user.avatar_version ? (
        <img alt="" src={`/api/account/avatar?v=${user.avatar_version}`} />
      ) : (
        user.name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((v) => v[0])
          .join("")
          .toUpperCase()
      )}
    </span>
  );
}
