/**
 * Smart transcript — remove fillers, normalize spoken language.
 * Keeps original separately.
 */

import type { SmartTranscript } from "./types";

const FILLER_PATTERNS: RegExp[] = [
  // Arabic / Syrian fillers
  /\bيعني\b/giu,
  /\bام+م+\b/giu,
  /\bآه+\b/giu,
  /\bاه+\b/giu,
  /\bهه+\b/giu,
  /\bطيب\s+طيب\b/giu,
  /\bخليني\s+شوف\b/giu,
  // English
  /\buh+\b/gi,
  /\bum+\b/gi,
  /\ber+\b/gi,
  /\blike\b(?=\s*,|\s+\.\.\.)/gi,
  /\byou\s+know\b/gi,
  // German
  /\bäh+\b/gi,
  /\bähm+\b/gi,
  /\balso\b(?=\s*,)/gi,
];

const ELLIPSIS_RE = /\.{2,}|…+/g;
const MULTI_SPACE_RE = /\s+/g;
const MULTI_COMMA_RE = /,+/g;

export function buildSmartTranscript(originalRaw: string): SmartTranscript {
  const original = originalRaw.replace(/\s+/g, " ").trim();
  const fillersRemoved: string[] = [];
  let normalized = original;

  for (const pattern of FILLER_PATTERNS) {
    normalized = normalized.replace(pattern, (match) => {
      const token = match.trim();
      if (token && !fillersRemoved.includes(token.toLowerCase())) {
        fillersRemoved.push(token.toLowerCase());
      }
      return " ";
    });
  }

  normalized = normalized
    .replace(ELLIPSIS_RE, " ")
    .replace(MULTI_COMMA_RE, ",")
    .replace(MULTI_SPACE_RE, " ")
    .replace(/^[,.\s]+|[,.\s]+$/g, "")
    .trim();

  // Light spoken → written cues (Syrian)
  normalized = normalized
    .replace(/\bعم\s+تسرب\b/giu, "تسرب")
    .replace(/\bعم\s+/giu, "")
    .replace(/\bشوي\b/giu, "")
    .replace(MULTI_SPACE_RE, " ")
    .trim();

  if (!normalized) normalized = original;

  return { original, normalized, fillersRemoved };
}
