/**
 * Knowledge facade — FAQ / policies; never hallucinate as policy truth.
 */

import { isAiPlatformEnabled } from "@/lib/config/feature-flags";
import { lookupKnowledge } from "@/lib/ai/knowledge/lookup";

export async function queryKnowledge(input: {
  text: string;
}): Promise<{
  matched: boolean;
  phrase: string | null;
  category: string | null;
  score: number;
  advisoryOnly: true;
  policyNote: string;
} | null> {
  if (!isAiPlatformEnabled()) return null;
  const hit = await lookupKnowledge(input.text);
  return {
    matched: Boolean(hit),
    phrase: hit?.phrase.phrase ?? null,
    category: hit?.phrase.categorySlug ?? null,
    score: hit?.score ?? 0,
    advisoryOnly: true,
    policyNote:
      "Knowledge matches are advisory. Official policies live in platform documentation.",
  };
}

export { lookupKnowledge };
