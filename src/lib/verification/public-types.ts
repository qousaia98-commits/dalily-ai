/** Public verification types — privacy-safe DTO only */

export type VerificationExpirationStatus =
  | "valid"
  | "expiring_soon"
  | "expired";

export type PublicVerificationCheck = {
  typeSlug: string;
  labelKey: string;
  nameEn: string;
  nameAr: string;
  verifiedAt: string | null;
  expirationStatus: VerificationExpirationStatus | null;
};

export type PublicVerificationLevelGroup = {
  levelSlug: string;
  labelKey: string;
  nameEn: string;
  nameAr: string;
  accent: string;
  sortOrder: number;
  checks: PublicVerificationCheck[];
};

export type PublicVerificationSummary = {
  providerId: string;
  isVerified: boolean;
  highestLevelSlug: string | null;
  highestLevelLabelKey: string | null;
  highestLevelNameEn: string | null;
  highestLevelNameAr: string | null;
  accent: string | null;
  levels: PublicVerificationLevelGroup[];
};
