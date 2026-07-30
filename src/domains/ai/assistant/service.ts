/**
 * Customer & Provider assistants — recommendations only; never auto-submit/send.
 */

import {
  isAiAssistantEnabled,
  isAiPlatformEnabled,
} from "@/lib/config/feature-flags";
import { completeWithFallback } from "@/domains/ai/providers";
import { buildCustomerAssistant } from "@/lib/ai/assistant/customer";
import { buildProviderAssistant } from "@/lib/ai/assistant/provider";
import { lookupKnowledge } from "@/lib/ai/knowledge/lookup";
import type {
  AiAssistantCapability,
  AiAssistantResponseView,
} from "@/domains/ai/shared/types";

function parseAssistantJson(
  content: string,
  capability: AiAssistantCapability,
  role: "customer" | "provider",
): AiAssistantResponseView {
  try {
    const parsed = JSON.parse(content) as {
      title?: string;
      body?: string;
      summary?: string;
      bullets?: string[];
      confidence?: number;
    };
    return {
      role,
      capability,
      title: parsed.title ?? capability.replace(/_/g, " "),
      body: parsed.body ?? parsed.summary ?? content.slice(0, 800),
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 8) : [],
      confidence:
        typeof parsed.confidence === "number"
          ? Math.min(1, Math.max(0, parsed.confidence))
          : 0.55,
      regeneratable: true,
      neverAutoSubmit: true,
      neverAutoSend: true,
    };
  } catch {
    return {
      role,
      capability,
      title: capability.replace(/_/g, " "),
      body: content.slice(0, 800),
      bullets: [],
      confidence: 0.4,
      regeneratable: true,
      neverAutoSubmit: true,
      neverAutoSend: true,
    };
  }
}

export async function runCustomerAssistant(input: {
  capability: AiAssistantCapability;
  prompt: string;
  userId: string;
  locale?: string;
  context?: Record<string, unknown>;
}): Promise<AiAssistantResponseView | null> {
  if (!isAiPlatformEnabled() || !isAiAssistantEnabled()) return null;

  if (input.capability === "platform_faq") {
    const hit = await lookupKnowledge(input.prompt);
    if (hit?.phrase) {
      return {
        role: "customer",
        capability: "platform_faq",
        title: "Knowledge match",
        body: `Matched knowledge phrase “${hit.phrase.phrase}” (category: ${hit.phrase.categorySlug}). Verify against official Dalily policies.`,
        bullets: [
          "Answer sourced from Dalily knowledge — never treat as legal policy.",
          "You remain in control of every action.",
        ],
        confidence: hit.score ?? 0.7,
        regeneratable: true,
        neverAutoSubmit: true,
        neverAutoSend: true,
      };
    }
  }

  const system = `You are Dalily's customer assistant. Locale=${input.locale ?? "en"}.
Capabilities: improve descriptions, structure requests, categories, budget/time estimates, provider explanations, offer comparison, review summaries, FAQ, dispute help.
Rules: recommendations only. Never submit requests. Never invent policies. Respond as JSON: {"title","body","bullets":[],"confidence":0-1}.`;

  const result = await completeWithFallback({
    feature: "assistant",
    actorUserId: input.userId,
    jsonMode: true,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: JSON.stringify({
          capability: input.capability,
          prompt: input.prompt,
          context: input.context ?? {},
        }),
      },
    ],
  });

  if (!result.ok) return null;
  return parseAssistantJson(result.content, input.capability, "customer");
}

export async function runProviderAssistant(input: {
  capability: AiAssistantCapability;
  prompt: string;
  userId: string;
  locale?: string;
  context?: Record<string, unknown>;
}): Promise<AiAssistantResponseView | null> {
  if (!isAiPlatformEnabled() || !isAiAssistantEnabled()) return null;

  const system = `You are Dalily's provider assistant. Locale=${input.locale ?? "en"}.
Capabilities: offer drafts, proposal/profile improvements, pricing suggestions, appointment times, portfolio/trust tips, reply drafts, chat summaries.
Rules: drafts and suggestions only. Never send messages or offers. Respond as JSON: {"title","body","bullets":[],"confidence":0-1}.`;

  const result = await completeWithFallback({
    feature: "assistant",
    actorUserId: input.userId,
    jsonMode: true,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: JSON.stringify({
          capability: input.capability,
          prompt: input.prompt,
          context: input.context ?? {},
        }),
      },
    ],
  });

  if (!result.ok) return null;
  return parseAssistantJson(result.content, input.capability, "provider");
}

/** Bridge to existing lifecycle assistants (Sprint 7/8). */
export { buildCustomerAssistant, buildProviderAssistant };
