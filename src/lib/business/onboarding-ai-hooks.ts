/**
 * Future AI assistants for provider onboarding — architecture only.
 */

export type OnboardingAiExtension =
  | "profile_completion_suggestions"
  | "portfolio_recommendations"
  | "missing_information_detection"
  | "profile_quality_recommendations"
  | "additional_service_suggestions";

export function listOnboardingAiExtensions(): OnboardingAiExtension[] {
  return [
    "profile_completion_suggestions",
    "portfolio_recommendations",
    "missing_information_detection",
    "profile_quality_recommendations",
    "additional_service_suggestions",
  ];
}

export async function runOnboardingAiHook(
  extension: OnboardingAiExtension,
  _context: Record<string, unknown>,
): Promise<{ extension: OnboardingAiExtension; supported: false }> {
  void _context;
  return { extension, supported: false };
}
