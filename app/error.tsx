"use client";
import { usePreferences } from "../components/preferences";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t: tx, locale, n } = usePreferences();

  return (
    <main className="loading-screen">
      <h1>{tx("Something interrupted your visit.")}</h1>
      <p>{tx("Please try again. Your saved queue is safe.")}</p>
      <button className="button primary" onClick={reset}>
        {tx("Try again")}
      </button>
    </main>
  );
}
