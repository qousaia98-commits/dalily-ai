/**
 * Offer quality nudges (anti-spam / thin-offer flags) — product hygiene, not ranking payola.
 */

export const OFFER_QUALITY_FLAG_CODES = [
  "thin_pitch",
  "missing_eta",
  "missing_inclusions",
  "price_only",
] as const;

export type OfferQualityFlag = (typeof OFFER_QUALITY_FLAG_CODES)[number];

export function computeOfferQualityFlags(input: {
  message?: string | null;
  etaText?: string | null;
  inclusions?: string | null;
}): OfferQualityFlag[] {
  const flags: OfferQualityFlag[] = [];
  const message = (input.message ?? "").trim();
  const eta = (input.etaText ?? "").trim();
  const inclusions = (input.inclusions ?? "").trim();

  if (message.length < 20) flags.push("thin_pitch");
  if (!eta) flags.push("missing_eta");
  if (!inclusions) flags.push("missing_inclusions");
  if (message.length === 0 && !eta && !inclusions) flags.push("price_only");

  return flags;
}
