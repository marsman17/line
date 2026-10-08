import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appearance,
  contrast,
  normalizeColor,
  colorPresets,
} from "../lib/appearance.ts";
import { translate, number, supportedLanguages } from "../lib/translations.ts";
test("custom colors normalize and reject CSS injection", () => {
  assert.equal(normalizeColor(" ABC "), "#aabbcc");
  assert.equal(normalizeColor("#3B82F6"), "#3b82f6");
  for (const v of ["red", "#12345", "url(x)", ";color:red"])
    assert.equal(normalizeColor(v), null);
});
test("preset and extreme colors remain readable in both themes", () => {
  for (const raw of [
    ...colorPresets.map((p) => p.hex),
    "#000000",
    "#ffffff",
    "#888888",
  ])
    for (const dark of [true, false]) {
      const c = appearance(raw, dark);
      assert.ok(contrast(c.accent, c.onAccent) >= 4.5);
      assert.ok(contrast(c.ink, dark ? "#191b18" : "#f7f7f3") >= 4.5);
    }
});
test("workspace translations support all languages and preserve customer names", () => {
  for (const lang of supportedLanguages) {
    for (const text of [
      "Overview",
      "Queue",
      "Customers",
      "Analytics",
      "Website color",
    ])
      if (lang !== "en") assert.notEqual(translate(lang, text), text);
    assert.ok(
      translate(
        lang,
        "{name} will be removed from the active queue. Their visit remains in your history.",
        { name: "Alex Morgan" },
      ).includes("Alex Morgan"),
    );
  }
  assert.equal(number("ur", 123), "۱۲۳");
  assert.ok(
    translate("ur", "{count} customers match", { count: 123 }).includes("۱۲۳"),
  );
});
