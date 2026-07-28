/**
 * Security foundation — biometric + sensitive screens.
 * Biometric implementation lives in features/native/biometrics (Phase 4).
 */

import {
  authenticateBiometric,
  getBiometricCapability,
  isBiometricUnlockEnabled,
} from '@/features/native/biometrics/service';
import { featureFlags } from '@/constants/env';
import { logEvent } from '@/lib/observability';

export async function isBiometricAvailable(): Promise<boolean> {
  if (!featureFlags.biometricPrep && !featureFlags.nativeBiometrics) return false;
  const cap = await getBiometricCapability();
  return cap.hardware && cap.enrolled;
}

export async function authenticateWithBiometrics(
  prompt = 'Unlock Dalily',
): Promise<boolean> {
  if (!(await isBiometricUnlockEnabled()) && !(await isBiometricAvailable())) {
    return false;
  }
  const ok = await authenticateBiometric(prompt);
  logEvent('biometric_attempt', { success: ok });
  return ok;
}

/** Certificate pinning preparation — wire native SSL pinning in a future build. */
export const certificatePinning = {
  enabled: false,
  pins: [] as string[],
  note: 'Prepare native config (TrustKit / OkHttp CertificatePinner) before production hardening.',
};

export type SensitiveScreenOptions = {
  /** Blur / hide content in app switcher — wire with expo-screen-capture later. */
  preventCapture: boolean;
};

export function getSensitiveScreenDefaults(): SensitiveScreenOptions {
  return { preventCapture: true };
}
