"use server";

import { getTranslationService } from "@/lib/translation";
import { requireAuthUser } from "@/lib/auth/session";
import { isBusinessUser } from "@/lib/auth/roles";
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
    const authUser = await requireAuthUser();
    if (!isBusinessUser(authUser.roles)) {
      return { success: false, error: "forbidden" };
    }

    // syncField never throws on provider failure — opposite locale may be empty.
    const result = await getTranslationService().syncField({
      sourceLocale,
      sourceText,
      existing: { ar: existingAr, en: existingEn },
    });
    return { success: true, result };
  } catch (error) {
    // Never swallow Next.js redirect() from requireAuthUser
    const digest = (error as { digest?: string } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("[translation] previewLocalizedFieldAction failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    // Never expose internal API errors to the client.
    return { success: false, error: "translation_unavailable" };
  }
}
