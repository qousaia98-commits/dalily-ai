import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  getPublicProviderTrustProfile,
  toPublicProviderApiDto,
} from "@/lib/providers/public-profile";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";

type RouteParams = { params: Promise<{ id: string }> };

/** Simple per-process rate window to blunt ID enumeration. */
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_HITS = 60;

function allow(key: string): boolean {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || row.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  row.count += 1;
  return row.count <= MAX_HITS;
}

/**
 * Authenticated public provider trust profile API.
 * Never returns phone, email, WhatsApp, GPS, documents, or payment fields.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const rateKey = `${authUser.id}:${request.headers.get("x-forwarded-for") ?? "local"}`;
  if (!allow(rateKey)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  // Uniform not-found for invalid IDs (no existence oracle via error shape).
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const profile = await getPublicProviderTrustProfile(id);
  if (!profile) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const locale = ((await getLocale()) as Locale) === "ar" ? "ar" : "en";
  return NextResponse.json(
    { provider: toPublicProviderApiDto(profile, locale) },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    },
  );
}
