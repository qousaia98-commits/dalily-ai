/**
 * Future AI assistants for verification feedback — architecture only.
 */

export type VerificationAiExtension =
  | "suggest_retake_blurry_photos"
  | "detect_missing_document_types"
  | "recommend_image_improvements";

export function listVerificationAiExtensions(): VerificationAiExtension[] {
  return [
    "suggest_retake_blurry_photos",
    "detect_missing_document_types",
    "recommend_image_improvements",
  ];
}

export async function runVerificationAiHook(
  extension: VerificationAiExtension,
  _context: Record<string, unknown>,
): Promise<{ extension: VerificationAiExtension; supported: false }> {
  void _context;
  return { extension, supported: false };
}
