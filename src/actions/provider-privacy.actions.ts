"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { createClient } from "@/lib/supabase/server";
import {
  mergePublicVisibilityIntoMetadata,
  type PublicVisibilityFlags,
} from "@/lib/providers/public-visibility";
import type { Json } from "@/types/database.types";

export type PrivacyActionState = {
  success: boolean;
  error?: string;
};

export async function updatePublicVisibilityAction(
  visibility: PublicVisibilityFlags,
): Promise<PrivacyActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("providers")
    .select("metadata")
    .eq("id", provider.id)
    .maybeSingle();

  const metadata = mergePublicVisibilityIntoMetadata(
    row?.metadata,
    visibility,
  ) as Json;
  const { error } = await supabase
    .from("providers")
    .update({
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", provider.id)
    .eq("owner_id", authUser.id);

  if (error) return { success: false, error: "save_failed" };

  revalidatePath("/business/settings");
  revalidatePath(`/providers/${provider.id}`);
  return { success: true };
}
