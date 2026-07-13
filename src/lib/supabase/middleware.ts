import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { enforceRouteAuth } from "@/lib/auth/middleware";
import type { Database } from "@/types/database.types";
import type { AppSupabaseClient } from "@/lib/supabase/app-client";
export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();

  if (!env) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const setAll: SetAllCookies = (cookiesToSet) => {
    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
    supabaseResponse = NextResponse.next({ request });
    cookiesToSet.forEach(({ name, value, options }) =>
      supabaseResponse.cookies.set(name, value, options),
    );
  };

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll,
    },
  }) as unknown as AppSupabaseClient;
  await supabase.auth.getUser();

  supabaseResponse = await enforceRouteAuth(request, supabaseResponse, supabase);

  return supabaseResponse;
}
