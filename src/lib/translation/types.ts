import type { Locale } from "@/lib/i18n/config";
import type { LocalizedJson } from "@/types/database.types";

export type TranslationProviderKind = "ai";

export interface TranslationProvider {
  readonly kind: TranslationProviderKind;
  translate(text: string, from: Locale, to: Locale): Promise<string>;
}

export type SyncLocalizedFieldInput = {
  sourceLocale: Locale;
  sourceText: string;
  existing: LocalizedJson;
};
