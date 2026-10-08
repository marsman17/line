export const colorPresets = [
  { name: "Amber", hex: "#f2aa35" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Rose", hex: "#f43f5e" },
  { name: "Green", hex: "#22c55e" },
];
export function normalizeColor(value: string) {
  const clean = value.trim().replace(/^#/, "");
  return /^[a-f0-9]{3}$/i.test(clean)
    ? "#" +
        clean
          .split("")
          .map((c) => c + c)
          .join("")
          .toLowerCase()
    : /^[a-f0-9]{6}$/i.test(clean)
      ? "#" + clean.toLowerCase()
      : null;
}
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((n) => {
    const v = n / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function appearance(accent: string, dark: boolean) {
  const background = dark ? "#191b18" : "#f7f7f3";
  const onAccent =
    contrast(accent, "#000000") >= contrast(accent, "#ffffff")
      ? "#000000"
      : "#ffffff";
  let ink = accent;
  const channel = dark ? 255 : 0;
  for (let i = 1; contrast(ink, background) < 4.5 && i <= 20; i++) {
    const c = rgb(accent).map((v) => Math.round(v + ((channel - v) * i) / 20));
    ink = "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  return { accent, ink, onAccent };
}
