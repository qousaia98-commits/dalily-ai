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
  _context: Record<string, unknown>,
): Promise<{ extension: AdminAiExtension; supported: false }> {
  void _context;
  return { extension, supported: false };
}
