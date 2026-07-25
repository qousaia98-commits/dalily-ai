/**
 * Unlock policy constants (Sprint 5). Fee capture is Sprint 6.
 */

export function getUnlockFeeSnapshot(): { amount: number; currency: string } {
  const amount = Number(process.env.UNLOCK_FEE_AMOUNT ?? "5000");
  const currency = (process.env.UNLOCK_FEE_CURRENCY ?? "SYP").trim() || "SYP";
  return {
    amount: Number.isFinite(amount) && amount > 0 ? amount : 5000,
    currency: currency.slice(0, 8),
  };
}

export function getUnlockSlaHours(): number {
  const hours = Number(process.env.UNLOCK_SLA_HOURS ?? "24");
  if (!Number.isFinite(hours) || hours <= 0) return 24;
  return Math.min(hours, 168);
}

export const UNLOCK_SESSION_STATUSES = [
  "opened",
  "payment_pending",
  "succeeded",
  "declined",
  "timed_out",
] as const;

export type UnlockSessionStatus = (typeof UNLOCK_SESSION_STATUSES)[number];

export const CONTACT_RELEASE_DEFAULT_SCOPE = [
  "phone",
  "whatsapp",
  "address",
  "chat",
] as const;

export type UnlockSessionView = {
  id: string;
  selectionId: string;
  serviceRequestId: string;
  providerId: string;
  offerId: string | null;
  status: UnlockSessionStatus;
  feeAmount: number;
  feeCurrency: string;
  slaDeadline: string;
  fallbackApplied: boolean;
  openedAt: string;
  closedAt: string | null;
};

export type ContactReleaseGrantView = {
  id: string;
  unlockSessionId: string;
  serviceRequestId: string;
  providerId: string;
  customerId: string;
  scope: string[];
  grantedAt: string;
};

export type ReleasedContact = {
  phone: string | null;
  whatsapp: string | null;
  addressLine: unknown;
  grantId: string;
};
