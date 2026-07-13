import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { AppSupabaseClient } from "@/lib/supabase/app-client";

export function createAdminClient(): AppSupabaseClient {  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL for admin operations.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as unknown as AppSupabaseClient;
}