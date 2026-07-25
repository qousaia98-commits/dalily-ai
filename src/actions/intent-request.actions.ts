"use server";

import { getAuthUser } from "@/lib/auth/session";
import { isCustomerIntentFlowV2Enabled } from "@/lib/config/feature-flags";
import { suggestCategoryFromIntent } from "@/domains/customer/suggest-category";
import { publishIntentRequest } from "@/domains/customer/publish-intent";
import type { CategorySuggestion, IntentUrgency } from "@/domains/customer/intent-types";
import { getLeafCategories } from "@/lib/categories/queries";
import { getLocalizedText } from "@/types/domain.types";

export type IntentActionState = {
  success: boolean;
  error?: string;
  requestId?: string;
  suggestion?: CategorySuggestion | null;
  categories?: Array<{
    id: string;
    slug: string;
    labelEn: string;
    labelAr: string;
  }>;
};

export async function suggestIntentCategoryAction(
  intentText: string,
): Promise<IntentActionState> {
  if (!isCustomerIntentFlowV2Enabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const suggestion = await suggestCategoryFromIntent(intentText);
  const leaves = await getLeafCategories();
  return {
    success: true,
    suggestion,
    categories: leaves.map((leaf) => ({
      id: leaf.id,
      slug: leaf.slug,
      labelEn: getLocalizedText(leaf.name, "en") || leaf.slug,
      labelAr: getLocalizedText(leaf.name, "ar") || leaf.slug,
    })),
  };
}

export async function publishIntentRequestAction(
  formData: FormData,
): Promise<IntentActionState> {
  if (!isCustomerIntentFlowV2Enabled()) {
    return { success: false, error: "feature_disabled" };
  }

  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const urgencyRaw = String(formData.get("urgency") ?? "normal");
  const urgency: IntentUrgency =
    urgencyRaw === "emergency" ? "emergency" : "normal";

  const photos = formData
    .getAll("photos")
    .filter((v): v is File => typeof File !== "undefined" && v instanceof File && v.size > 0);

  const result = await publishIntentRequest({
    customerId: authUser.id,
    data: {
      intentText: String(formData.get("intentText") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      cityId: String(formData.get("cityId") ?? ""),
      urgency,
      locationText: String(formData.get("locationText") ?? "") || undefined,
    },
    photos,
  });

  if (!result.ok) return { success: false, error: result.error };
  return { success: true, requestId: result.requestId };
}
