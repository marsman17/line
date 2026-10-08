"use client";
import { usePreferences } from "../components/preferences";
export default function NotFound() {
  const { t: tx, locale, n } = usePreferences();

  return (
    <main className="loading-screen">
      <span className="brand-icon">
        {tx("T")}
        <span>{tx("Q")}</span>
      </span>
      <h1>{tx("This table doesn’t exist.")}</h1>
      <p>{tx("The page you’re looking for could not be found.")}</p>
      <a className="button primary" href="/">
        {tx("Back to TableQ")}
      </a>
    </main>
  );
}
