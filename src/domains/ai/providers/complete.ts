/**
 * Complete with primary provider + optional fallback. Records usage when possible.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getLlmProvider,
  resolveFallbackLlmProviderId,
  resolveLlmProviderId,
} from "./registry";
import type { LlmCompleteInput } from "./types";
import type { AiCompletionResult, AiPlatformFeature } from "@/domains/ai/shared/types";

async function recordUsage(input: {
  feature: AiPlatformFeature;
  result: AiCompletionResult;
  actorUserId?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("ai_platform_usage").insert({
      feature: input.feature,
      provider_id: input.result.providerId,
      model: input.result.ok ? input.result.model : null,
      success: input.result.ok,
      latency_ms: input.result.ok ? input.result.latencyMs : null,
      prompt_tokens: input.result.ok ? input.result.promptTokens ?? null : null,
      completion_tokens: input.result.ok
        ? input.result.completionTokens ?? null
        : null,
      error_code: input.result.ok ? null : input.result.error,
      fallback_used: input.result.fallbackUsed,
      actor_user_id: input.actorUserId ?? null,
    });
  } catch {
    /* soft — table may be absent before migration */
  }
}

export async function completeWithFallback(input: {
  messages: LlmCompleteInput["messages"];
  feature: AiPlatformFeature;
  temperature?: number;
  jsonMode?: boolean;
  actorUserId?: string | null;
  providerOverride?: string | null;
}): Promise<AiCompletionResult> {
  const primaryId = resolveLlmProviderId(input.providerOverride);
  const primary = getLlmProvider(primaryId);
  const first = await primary.complete({
    messages: input.messages,
    temperature: input.temperature,
    jsonMode: input.jsonMode,
    feature: input.feature,
  });

  if (first.ok) {
    await recordUsage({
      feature: input.feature,
      result: first,
      actorUserId: input.actorUserId,
    });
    return first;
  }

  const fallbackId = resolveFallbackLlmProviderId();
  if (fallbackId === primaryId) {
    await recordUsage({
      feature: input.feature,
      result: first,
      actorUserId: input.actorUserId,
    });
    return first;
  }

  const second = await getLlmProvider(fallbackId).complete({
    messages: input.messages,
    temperature: input.temperature,
    jsonMode: input.jsonMode,
    feature: input.feature,
  });

  const result: AiCompletionResult = second.ok
    ? { ...second, fallbackUsed: true }
    : { ...second, fallbackUsed: true };

  await recordUsage({
    feature: input.feature,
    result,
    actorUserId: input.actorUserId,
  });
  return result;
}
