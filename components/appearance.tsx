"use client";
import { useEffect, useState } from "react";
import { usePreferences } from "./preferences";
import { colorPresets, normalizeColor } from "../lib/appearance";
export default function AppearanceSettings() {
  const { user, update, t } = usePreferences();
  const [hex, setHex] = useState(user?.accent || "#f2aa35");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    if (user) setHex(user.accent);
  }, [user?.accent]);
  const color = normalizeColor(hex);
  return (
    <section id="appearance" className="profile-card appearance-settings">
      <h2>{t("Website color")}</h2>
      <p>
        {t(
          "Choose a preset or enter a custom hex color. Your choice applies to all themes.",
        )}
      </p>
      <div className="color-presets">
        {colorPresets.map((p) => (
          <button
            key={p.hex}
            type="button"
            className="color-preset"
            aria-pressed={color === p.hex}
            onClick={() => {
              setHex(p.hex);
              setSaved(false);
              setError("");
            }}
          >
            <span style={{ background: p.hex }} />
            {t(p.name)}
          </button>
        ))}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!color) {
            setError("Enter a valid hex color.");
            return;
          }
          setBusy(true);
          setError("");
          setSaved(false);
          try {
            await update({ accent: color });
            setSaved(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="profile-field">
          {t("Hex color")}
          <input
            dir="ltr"
            value={hex}
            maxLength={7}
            placeholder="#3b82f6"
            onChange={(e) => {
              setHex(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        {error && (
          <p role="alert" className="account-error">
            {t(error)}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {t(busy ? "Saving…" : "Save color")}
        </button>
        {saved && <p role="status">{t("Website color saved.")}</p>}
      </form>
    </section>
  );
}
