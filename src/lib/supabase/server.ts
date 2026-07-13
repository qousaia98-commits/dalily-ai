import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";
import type { AppSupabaseClient } from "@/lib/supabase/app-client";

export async function createClient(): Promise<AppSupabaseClient> {  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseEnv();

  const setAll: SetAllCookies = (cookiesToSet) => {
    try {
      cookiesToSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options),
      );
    } catch {
      // Server Components cannot write cookies; middleware handles refresh.
    }
  };

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll,
    },
  }) as unknown as AppSupabaseClient;
}