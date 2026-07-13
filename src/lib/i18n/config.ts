export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export type AppLocale = Locale;

export const defaultLocale: AppLocale = "ar";

export const localeNames: Record<AppLocale, string> = {
  ar: "العربية",
  en: "English",
};

export const localeDirection: Record<AppLocale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as AppLocale);
}
