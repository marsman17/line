import catalog from "./locales/catalog.json";
export const languageNames = {
  en: "English",
  es: "Español",
  pt: "Português",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  ur: "اردو",
};
export type Language = keyof typeof languageNames;
export const supportedLanguages = Object.keys(languageNames) as Language[];
export type Parameters = Record<string, string | number>;
export const localeFor = (language: Language) =>
  language === "ur" ? "ur-PK-u-nu-arabext" : language;
export const number = (language: Language, value: number) =>
  new Intl.NumberFormat(localeFor(language)).format(value);
export function translate(
  language: Language,
  text: string,
  params: Parameters = {},
) {
  const key = text.trim();
  const index = ["es", "pt", "de", "fr", "it", "ur"].indexOf(language);
  const localized =
    language === "en"
      ? text
      : (catalog as Record<string, string[]>)[key]?.[index];
  const result =
    localized === undefined
      ? text
      : text.slice(0, text.indexOf(key)) +
        localized +
        text.slice(text.indexOf(key) + key.length);
  return result.replace(/\{(\w+)\}/g, (placeholder, name) => {
    const value = params[name];
    return value === undefined
      ? placeholder
      : typeof value === "number"
        ? number(language, value)
        : value;
  });
}
export const hasTranslation = (text: string) =>
  Object.hasOwn(catalog, text.trim());
