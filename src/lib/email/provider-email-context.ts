import { createAdminClient } from "@/lib/supabase/admin";
import type { LocalizedJson } from "@/types/database.types";
import { resolveProviderBusinessName } from "@/lib/people/display-name";

export async function getProviderOwnerEmailContext(providerId: string): Promise<{
  ownerId: string;
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
  const locale = name?.ar ? "ar" : "en";
  const businessName = resolveProviderBusinessName(name, locale);

  return {
    ownerId: provider.owner_id,
    email: authUser.user?.email ?? "",
    businessName,
    locale,
  };
}
