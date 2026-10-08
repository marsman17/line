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
import { translate } from "../lib/translations";
const Context = createContext<{
  user: Account | null;
  refresh: () => Promise<void>;
  update: (
    data: Partial<Pick<Account, "name" | "language" | "theme">>,
  ) => Promise<Account>;
  setUser: (u: Account) => void;
  t: (s: string) => string;
}>({
  user: null,
  refresh: async () => {},
  update: async () => {
    throw Error("Not ready");
  },
  setUser: () => {},
  t: (s) => s,
});
export function Preferences({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const refresh = useCallback(async () => {
    try {
      setUser(await api<Account>("account"));
    } catch {}
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        user?.theme === "system"
          ? mq.matches
            ? "dark"
            : "light"
          : user?.theme || "dark";
      document.documentElement.lang = user?.language || "en";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [user]);
  const update = async (
    data: Partial<Pick<Account, "name" | "language" | "theme">>,
  ) => {
    const result = await api<Account>("account", "PATCH", data);
    setUser(result);
    return result;
  };
  return (
    <Context.Provider
      value={{
        user,
        refresh,
        update,
        setUser,
        t: (s) => translate(user?.language || "en", s),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
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
