import { createAdminClient } from "@/lib/supabase/admin";
import type { LocalizedJson } from "@/types/database.types";

export async function getProviderOwnerEmailContext(providerId: string): Promise<{
  email: string;
  businessName: string;
  locale: string;
} | null> {
  const admin = createAdminClient();
  const { data: provider } = await admin
    .from("providers")
    .select("name, owner_id")
    .eq("id", providerId)
    .maybeSingle();

  if (!provider?.owner_id) return null;

  const { data: authUser } = await admin.auth.admin.getUserById(provider.owner_id);
  const name = provider.name as LocalizedJson;
  const businessName = name?.en || name?.ar || "Business";
  const locale = name?.ar ? "ar" : "en";

  return {
    email: authUser.user?.email ?? "",
    businessName,
    locale,
  };
}
