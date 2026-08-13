/**
 * Customer preferences — learn & persist.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CustomerPreferences } from "@/lib/matching-engine/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPrefs(row: any): CustomerPreferences {
  return {
    customerId: row.customer_id,
    preferredLanguage: row.preferred_language,
    preferredGender: row.preferred_gender,
    budgetMin: row.budget_min != null ? Number(row.budget_min) : null,
    budgetMax: row.budget_max != null ? Number(row.budget_max) : null,
    preferredResponseSpeed: row.preferred_response_speed,
    favouriteProviderIds: (row.favourite_provider_ids as string[]) ?? [],
    preferredHours: (row.preferred_hours as Record<string, unknown>) ?? {},
    favouriteCategories: (row.favourite_categories as string[]) ?? [],
    frequentLocations: (row.frequent_locations as unknown[]) ?? [],
    learnedProfile: (row.learned_profile as Record<string, unknown>) ?? {},
  };
}

export async function getCustomerPreferences(
  customerId: string,
): Promise<CustomerPreferences | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("customer_preferences")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle();
    return data ? mapPrefs(data) : null;
  } catch {
    return null;
  }
}

export async function upsertCustomerPreferences(input: {
  customerId: string;
  patch: Partial<{
    preferredLanguage: string | null;
    preferredGender: string | null;
    budgetMin: number | null;
    budgetMax: number | null;
    preferredResponseSpeed: "fast" | "normal" | "flexible" | null;
    favouriteProviderIds: string[];
    favouriteCategories: string[];
  }>;
}): Promise<CustomerPreferences | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("customer_preferences")
      .upsert(
        {
          customer_id: input.customerId,
          preferred_language: input.patch.preferredLanguage,
          preferred_gender: input.patch.preferredGender,
          budget_min: input.patch.budgetMin,
          budget_max: input.patch.budgetMax,
          preferred_response_speed: input.patch.preferredResponseSpeed,
          favourite_provider_ids: input.patch.favouriteProviderIds ?? [],
          favourite_categories: input.patch.favouriteCategories ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "customer_id" },
      )
      .select("*")
      .single();
    return data ? mapPrefs(data) : null;
  } catch {
    return null;
  }
}

/** Soft learning after booking feedback */
export async function learnFromMatchFeedback(input: {
  customerId: string;
  providerId: string;
  accepted: boolean;
  rating?: number | null;
  categoryId?: string | null;
}): Promise<void> {
  try {
    const existing = await getCustomerPreferences(input.customerId);
    const favourites = new Set(existing?.favouriteProviderIds ?? []);
    const categories = new Set(existing?.favouriteCategories ?? []);
    if (input.accepted && (input.rating == null || input.rating >= 4)) {
      favourites.add(input.providerId);
    }
    if (input.categoryId) categories.add(input.categoryId);
    await upsertCustomerPreferences({
      customerId: input.customerId,
      patch: {
        favouriteProviderIds: [...favourites].slice(0, 40),
        favouriteCategories: [...categories].slice(0, 20),
        preferredResponseSpeed: existing?.preferredResponseSpeed ?? null,
      },
    });
  } catch {
    /* soft */
  }
}
