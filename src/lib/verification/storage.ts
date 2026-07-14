import { PROVIDER_VERIFICATION_BUCKET } from "@/lib/verification/constants";
import type { VerificationDocType } from "@/lib/verification/constants";

export function buildVerificationStoragePath(
  ownerId: string,
  providerId: string,
  docType: VerificationDocType,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${ownerId}/${providerId}/${docType}/${Date.now()}-${safeName}`;
}

export { PROVIDER_VERIFICATION_BUCKET };
