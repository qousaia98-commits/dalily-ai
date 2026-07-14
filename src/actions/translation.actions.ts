"use server";

import { getTranslationService } from "@/lib/translation";
import type { Locale } from "@/lib/i18n/config";
import type { LocalizedJson } from "@/types/database.types";

export type PreviewTranslationState = {
  success: boolean;
  result?: LocalizedJson;
  error?: string;
};

export async function previewLocalizedFieldAction(
  sourceLocale: Locale,
  sourceText: string,
  existingAr: string,
  existingEn: string,
): Promise<PreviewTranslationState> {
  try {
    const result = await getTranslationService().syncField({
      sourceLocale,
      sourceText,
      existing: { ar: existingAr, en: existingEn },
    });
    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "translation_failed",
    };
  }
}
