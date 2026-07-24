/**
 * Official Dalily message categories + optional rich layouts.
 * Architecture only — old messages without category stay uncategorized.
 */

export const DALILY_MESSAGE_CATEGORIES = [
  "announcement",
  "security",
  "feature",
  "billing",
  "maintenance",
  "verification",
] as const;

export type DalilyMessageCategory = (typeof DALILY_MESSAGE_CATEGORIES)[number];

export type DalilyRichCta = {
  labelKey?: string;
  label?: string;
  href: string;
};

export type DalilyRichContent = {
  banner?: string | null;
  cardTitle?: string | null;
  cardBody?: string | null;
  statusChip?: string | null;
  statusTone?: "success" | "warning" | "info" | "neutral";
  cta?: DalilyRichCta | null;
};

export function isDalilyMessageCategory(value: unknown): value is DalilyMessageCategory {
  return (
    typeof value === "string" &&
    (DALILY_MESSAGE_CATEGORIES as readonly string[]).includes(value)
  );
}

export function parseDalilyCategory(
  params: Record<string, string | number> | undefined | null,
): DalilyMessageCategory | null {
  if (!params) return null;
  const raw = params.category;
  return isDalilyMessageCategory(raw) ? raw : null;
}

export function parseDalilyRichContent(
  params: Record<string, string | number> | undefined | null,
): DalilyRichContent | null {
  if (!params) return null;
  const banner = typeof params.banner === "string" ? params.banner : null;
  const cardTitle = typeof params.cardTitle === "string" ? params.cardTitle : null;
  const cardBody = typeof params.cardBody === "string" ? params.cardBody : null;
  const statusChip = typeof params.statusChip === "string" ? params.statusChip : null;
  const statusToneRaw = typeof params.statusTone === "string" ? params.statusTone : null;
  const statusTone =
    statusToneRaw === "success" ||
    statusToneRaw === "warning" ||
    statusToneRaw === "info" ||
    statusToneRaw === "neutral"
      ? statusToneRaw
      : undefined;
  const ctaHref = typeof params.ctaHref === "string" ? params.ctaHref : null;
  const ctaLabel = typeof params.ctaLabel === "string" ? params.ctaLabel : null;
  const ctaLabelKey = typeof params.ctaLabelKey === "string" ? params.ctaLabelKey : null;

  if (!banner && !cardTitle && !cardBody && !statusChip && !ctaHref) return null;

  return {
    banner,
    cardTitle,
    cardBody,
    statusChip,
    statusTone,
    cta: ctaHref
      ? {
          href: ctaHref,
          label: ctaLabel ?? undefined,
          labelKey: ctaLabelKey ?? undefined,
        }
      : null,
  };
}
