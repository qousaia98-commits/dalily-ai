/**
 * Privacy-safe public verification summary.
 * Never returns documents, IDs, addresses, policy numbers, or internal notes.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PublicVerificationCheck,
  PublicVerificationLevelGroup,
  PublicVerificationSummary,
  VerificationExpirationStatus,
} from "./public-types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function expirationStatus(
  expiresAt: string | null | undefined,
): VerificationExpirationStatus | null {
  if (!expiresAt) return "valid";
  const exp = new Date(expiresAt).getTime();
  if (!Number.isFinite(exp)) return "valid";
  const now = Date.now();
  if (exp < now) return "expired";
  const days = (exp - now) / 86_400_000;
  if (days <= 30) return "expiring_soon";
  return "valid";
}

/**
 * Grant a verified check (admin/system). Does not store document payloads.
 */
export async function grantProviderVerificationCheck(input: {
  providerId: string;
  typeSlug: string;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  reviewedBy?: string | null;
}): Promise<void> {
  const now = input.verifiedAt ?? new Date().toISOString();
  await db().from("provider_verification_checks").upsert(
    {
      provider_id: input.providerId,
      type_slug: input.typeSlug,
      status: "verified",
      verified_at: now,
      expires_at: input.expiresAt ?? null,
      reviewed_by: input.reviewedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider_id,type_slug" },
  );
}

/** After identity approval — mark identity check public. */
export async function syncIdentityCheckOnApproval(input: {
  providerId: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}): Promise<void> {
  try {
    await grantProviderVerificationCheck({
      providerId: input.providerId,
      typeSlug: "identity",
      verifiedAt: input.reviewedAt ?? new Date().toISOString(),
      reviewedBy: input.reviewedBy,
    });
  } catch {
    // soft — catalog may not be migrated yet
  }
}

export async function getPublicVerificationSummary(
  providerId: string,
): Promise<PublicVerificationSummary | null> {
  try {
    const { data: provider } = await db()
      .from("providers")
      .select("id, verification_status, status, deleted_at")
      .eq("id", providerId)
      .maybeSingle();

    if (!provider || provider.deleted_at || provider.status !== "active") {
      return null;
    }

    const isProviderVerified = provider.verification_status === "verified";

    const [{ data: levels }, { data: types }, { data: checks }] =
      await Promise.all([
        db()
          .from("verification_levels")
          .select("slug, sort_order, accent, label_key, name_en, name_ar")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        db()
          .from("verification_types")
          .select(
            "slug, level_slug, sort_order, label_key, name_en, name_ar",
          )
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        db()
          .from("provider_verification_checks")
          .select("type_slug, status, verified_at, expires_at")
          .eq("provider_id", providerId)
          .eq("status", "verified"),
      ]);

    // Lazy backfill identity if legacy verified but no check row
    let checkRows = checks ?? [];
    if (
      isProviderVerified &&
      !checkRows.some((c: { type_slug: string }) => c.type_slug === "identity")
    ) {
      await syncIdentityCheckOnApproval({ providerId });
      const { data: refreshed } = await db()
        .from("provider_verification_checks")
        .select("type_slug, status, verified_at, expires_at")
        .eq("provider_id", providerId)
        .eq("status", "verified");
      checkRows = refreshed ?? [];
    }

    type LevelRow = {
      slug: string;
      sort_order: number;
      accent: string;
      label_key: string;
      name_en: string;
      name_ar: string;
    };
    type TypeRow = {
      slug: string;
      level_slug: string;
      sort_order: number;
      label_key: string;
      name_en: string;
      name_ar: string;
    };
    type CheckRow = {
      type_slug: string;
      verified_at: string | null;
      expires_at: string | null;
    };

    const checkByType = new Map<string, CheckRow>(
      (checkRows as CheckRow[]).map((c) => [c.type_slug, c]),
    );

    const levelMeta = new Map<string, LevelRow>(
      ((levels ?? []) as LevelRow[]).map((l) => [l.slug, l]),
    );

    const groups = new Map<string, PublicVerificationLevelGroup>();

    for (const type of (types ?? []) as TypeRow[]) {
      const check = checkByType.get(type.slug);
      if (!check) continue;
      const level = levelMeta.get(type.level_slug);
      if (!level) continue;

      let group = groups.get(level.slug);
      if (!group) {
        group = {
          levelSlug: level.slug,
          labelKey: level.label_key,
          nameEn: level.name_en,
          nameAr: level.name_ar,
          accent: level.accent,
          sortOrder: level.sort_order,
          checks: [],
        };
        groups.set(level.slug, group);
      }

      const publicCheck: PublicVerificationCheck = {
        typeSlug: type.slug,
        labelKey: type.label_key,
        nameEn: type.name_en,
        nameAr: type.name_ar,
        verifiedAt: check.verified_at,
        expirationStatus: expirationStatus(check.expires_at),
      };
      group.checks.push(publicCheck);
    }

    const levelGroups = [...groups.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    const highest = levelGroups.length
      ? levelGroups[levelGroups.length - 1]
      : null;

    return {
      providerId,
      isVerified: isProviderVerified || levelGroups.length > 0,
      highestLevelSlug: highest?.levelSlug ?? null,
      highestLevelLabelKey: highest?.labelKey ?? null,
      highestLevelNameEn: highest?.nameEn ?? null,
      highestLevelNameAr: highest?.nameAr ?? null,
      accent: highest?.accent ?? (isProviderVerified ? "green" : null),
      levels: levelGroups,
    };
  } catch {
    // Tables may not exist yet — fall back to legacy flag
    try {
      const { data: provider } = await db()
        .from("providers")
        .select("id, verification_status, status, deleted_at, published_at")
        .eq("id", providerId)
        .maybeSingle();
      if (!provider || provider.deleted_at || provider.status !== "active") {
        return null;
      }
      const verified = provider.verification_status === "verified";
      if (!verified) {
        return {
          providerId,
          isVerified: false,
          highestLevelSlug: null,
          highestLevelLabelKey: null,
          highestLevelNameEn: null,
          highestLevelNameAr: null,
          accent: null,
          levels: [],
        };
      }
      return {
        providerId,
        isVerified: true,
        highestLevelSlug: "basic",
        highestLevelLabelKey: "levels.basic",
        highestLevelNameEn: "Basic Verified",
        highestLevelNameAr: "تحقق أساسي",
        accent: "green",
        levels: [
          {
            levelSlug: "basic",
            labelKey: "levels.basic",
            nameEn: "Basic Verified",
            nameAr: "تحقق أساسي",
            accent: "green",
            sortOrder: 10,
            checks: [
              {
                typeSlug: "identity",
                labelKey: "types.identity",
                nameEn: "Identity Verified",
                nameAr: "الهوية موثّقة",
                verifiedAt: provider.published_at ?? null,
                expirationStatus: "valid",
              },
            ],
          },
        ],
      };
    } catch {
      return null;
    }
  }
}
