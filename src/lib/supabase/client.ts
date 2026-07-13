import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";

export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();

  return createBrowserClient<Database>(url, anonKey);
}
