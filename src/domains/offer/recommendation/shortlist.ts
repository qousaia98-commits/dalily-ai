/**
 * Hiring shortlist — persisted per customer + request in customer_preferences.learned_profile.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

const SHORTLIST_KEY = "hiring_shortlists";
const MAX_PER_REQUEST = 12;

type ShortlistMap = Record<string, string[]>;

function readMap(learned: unknown): ShortlistMap {
  if (!learned || typeof learned !== "object") return {};
  const raw = (learned as Record<string, unknown>)[SHORTLIST_KEY];
  if (!raw || typeof raw !== "object") return {};
  const out: ShortlistMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      out[k] = v.filter((id): id is string => typeof id === "string").slice(0, MAX_PER_REQUEST);
    }
  }
  return out;
}

export async function getHiringShortlist(input: {
  customerId: string;
  requestId: string;
}): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("customer_preferences")
      .select("learned_profile")
      .eq("customer_id", input.customerId)
      .maybeSingle();
    const map = readMap(data?.learned_profile);
    return map[input.requestId] ?? [];
  } catch {
    return [];
  }
}

export async function toggleHiringShortlist(input: {
  customerId: string;
  requestId: string;
  providerId: string;
}): Promise<{ ok: true; shortlisted: boolean; ids: string[] } | { ok: false; error: string }> {
  if (
    !/^[0-9a-f-]{36}$/i.test(input.requestId) ||
    !/^[0-9a-f-]{36}$/i.test(input.providerId)
  ) {
    return { ok: false, error: "validation_error" };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("customer_preferences")
    .select("learned_profile")
    .eq("customer_id", input.customerId)
    .maybeSingle();

  const learned =
    existing?.learned_profile && typeof existing.learned_profile === "object"
      ? { ...(existing.learned_profile as Record<string, unknown>) }
      : {};
  const map = readMap(learned);
  const current = new Set(map[input.requestId] ?? []);
  let shortlisted: boolean;
  if (current.has(input.providerId)) {
    current.delete(input.providerId);
    shortlisted = false;
  } else {
    if (current.size >= MAX_PER_REQUEST) {
      return { ok: false, error: "shortlist_full" };
    }
    current.add(input.providerId);
    shortlisted = true;
  }
  map[input.requestId] = [...current];
  learned[SHORTLIST_KEY] = map;

  const { error } = await admin.from("customer_preferences").upsert(
    {
      customer_id: input.customerId,
      learned_profile: learned as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" },
  );

  if (error) return { ok: false, error: "save_failed" };
  return { ok: true, shortlisted, ids: map[input.requestId] ?? [] };
}
