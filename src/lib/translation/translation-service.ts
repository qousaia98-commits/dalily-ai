import type { Locale } from "@/lib/i18n/config";
import type { LocalizedJson } from "@/types/database.types";
import { AITranslationProvider } from "@/lib/translation/providers/ai-translation.provider";
import { syncLocalizedField } from "@/lib/translation/sync-localized-field";
import type { SyncLocalizedFieldInput, TranslationProvider } from "@/lib/translation/types";

export class TranslationService {
  constructor(private readonly provider: TranslationProvider = new AITranslationProvider()) {}

  get providerKind() {
    return this.provider.kind;
  }

  translate(text: string, from: Locale, to: Locale): Promise<string> {
    return this.provider.translate(text, from, to);
  }

  syncField(input: SyncLocalizedFieldInput): Promise<LocalizedJson> {
    return syncLocalizedField(this.provider, input);
  }
}

let defaultService: TranslationService | null = null;

export function getTranslationService(): TranslationService {
  if (!defaultService) {
    defaultService = new TranslationService();
  }
  return defaultService;
}
