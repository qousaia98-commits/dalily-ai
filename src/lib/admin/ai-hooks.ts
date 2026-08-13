/**
 * Future AI assistants for Admin Control Center — architecture only.
 */

export type AdminAiExtension =
  | "fraud_detection"
  | "moderation_assistant"
  | "verification_assistant"
  | "trend_detection"
  | "growth_forecasting"
  | "automatic_abuse_detection";

export function listAdminAiExtensions(): AdminAiExtension[] {
  return [
    "fraud_detection",
    "moderation_assistant",
    "verification_assistant",
    "trend_detection",
    "growth_forecasting",
    "automatic_abuse_detection",
  ];
}

export async function runAdminAiHook(
  extension: AdminAiExtension,
  context: Record<string, unknown>,
): Promise<
  | { extension: AdminAiExtension; supported: false }
  | {
      extension:
        | "fraud_detection"
        | "automatic_abuse_detection"
        | "trend_detection";
      supported: true;
      result: unknown;
    }
> {
  if (
    (extension === "fraud_detection" || extension === "automatic_abuse_detection") &&
    (await import("@/lib/config/feature-flags")).isFraudDetectionEnabled()
  ) {
    const entityType = String(context.entityType ?? "provider") as
      | "provider"
      | "customer";
    const entityId = String(context.entityId ?? "");
    if (!entityId) {
      return { extension, supported: false };
    }
    const { recalculateEntityRisk } = await import("@/lib/fraud/service");
    const result = await recalculateEntityRisk({
      entityType,
      entityId,
      mlRiskScore:
        typeof context.mlRiskScore === "number" ? context.mlRiskScore : null,
    });
    return { extension, supported: true, result };
  }

  if (
    extension === "trend_detection" &&
    (await import("@/lib/config/feature-flags")).isAiOpsEnabled()
  ) {
    const { refreshPlatformOps } = await import("@/lib/ai-ops/service");
    const result = await refreshPlatformOps({});
    return { extension, supported: true, result };
  }

  return { extension, supported: false };
}
