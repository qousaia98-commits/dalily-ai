/**
 * Privacy & compliance — consent, deletion, export (GDPR-ready).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { env } from '@/constants/env';
import { logEvent } from '@/lib/observability';

const CONSENT_KEY = 'dalily.privacy.consent.v1';
const DELETION_KEY = 'dalily.privacy.deletion_request';

export type ConsentState = {
  analytics: boolean;
  crashReporting: boolean;
  marketing: boolean;
  acceptedPrivacyAt: number | null;
  acceptedTermsAt: number | null;
  version: number;
};

export const CONSENT_VERSION = 1;

export const DEFAULT_CONSENT: ConsentState = {
  analytics: false,
  crashReporting: true,
  marketing: false,
  acceptedPrivacyAt: null,
  acceptedTermsAt: null,
  version: CONSENT_VERSION,
};

export async function loadConsent(): Promise<ConsentState> {
  const raw = await AsyncStorage.getItem(CONSENT_KEY);
  if (!raw) return { ...DEFAULT_CONSENT };
  try {
    return { ...DEFAULT_CONSENT, ...(JSON.parse(raw) as ConsentState) };
  } catch {
    return { ...DEFAULT_CONSENT };
  }
}

export async function saveConsent(next: ConsentState): Promise<void> {
  await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify({ ...next, version: CONSENT_VERSION }));
  logEvent('privacy_consent_saved', {
    analytics: next.analytics,
    crashReporting: next.crashReporting,
    marketing: next.marketing,
  });
}

export async function acceptLegalDocuments(): Promise<ConsentState> {
  const current = await loadConsent();
  const next: ConsentState = {
    ...current,
    acceptedPrivacyAt: Date.now(),
    acceptedTermsAt: Date.now(),
  };
  await saveConsent(next);
  return next;
}

export function needsConsentGate(state: ConsentState): boolean {
  return !state.acceptedPrivacyAt || !state.acceptedTermsAt || state.version < CONSENT_VERSION;
}

export async function requestAccountDeletion(reason?: string): Promise<{ requestId: string }> {
  const requestId = `del_${Date.now()}`;
  await AsyncStorage.setItem(
    DELETION_KEY,
    JSON.stringify({ requestId, reason: reason ?? null, at: Date.now() }),
  );
  logEvent('privacy_deletion_requested', { requestId });
  // Hook: POST /v1/account/deletion-requests
  return { requestId };
}

export async function requestDataExport(): Promise<{ requestId: string }> {
  const requestId = `exp_${Date.now()}`;
  logEvent('privacy_export_requested', { requestId });
  // Hook: POST /v1/account/data-export
  return { requestId };
}

export async function openPrivacyPolicy(): Promise<void> {
  await Linking.openURL(env.privacyUrl);
}

export async function openTermsOfService(): Promise<void> {
  await Linking.openURL(env.termsUrl);
}

export const googleDataSafetySummary = {
  dataCollected: [
    'Email address',
    'Name',
    'Approximate / precise location (opt-in)',
    'Photos / media (user-uploaded)',
    'App activity / diagnostics',
  ],
  dataShared: false,
  encryptionInTransit: true,
  usersCanRequestDeletion: true,
  purpose: 'App functionality, fraud prevention, analytics (opt-in)',
} as const;

export const gdprControls = {
  consent: true,
  access: true,
  rectification: true,
  erasure: true,
  portability: true,
  objectionToMarketing: true,
} as const;
