import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  getPublicProviderTrustProfile,
  toPublicProviderApiDto,
} from "@/lib/providers/public-profile";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Authenticated public provider trust profile API.
 * Never returns phone, email, WhatsApp, GPS, documents, or payment fields.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const { id } = await params;
  if (!id || id.length > 80) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const profile = await getPublicProviderTrustProfile(id);
  if (!profile) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const locale = ((await getLocale()) as Locale) === "ar" ? "ar" : "en";
  return NextResponse.json({
    provider: toPublicProviderApiDto(profile, locale),
  });
}
