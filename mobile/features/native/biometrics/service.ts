/**
 * Biometric authentication — Face ID / Touch ID / Fingerprint + PIN fallback.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { featureFlags } from '@/constants/env';
import { trackNative } from '../observability';

const ENABLED_KEY = 'dalily.native.biometric.enabled';
const PIN_KEY = 'dalily.native.biometric.pin';
const SESSION_KEY = 'dalily.native.biometric.session';

export type BiometricCapability = {
  hardware: boolean;
  enrolled: boolean;
  types: LocalAuthentication.AuthenticationType[];
  label: string;
};

export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = hardware
      ? await LocalAuthentication.supportedAuthenticationTypesAsync()
      : [];
    let label = 'Biometrics';
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      label = 'Face ID';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      label = 'Fingerprint';
    }
    return { hardware, enrolled, types, label };
  } catch {
    return { hardware: false, enrolled: false, types: [], label: 'Biometrics' };
  }
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  if (!featureFlags.biometricPrep && !featureFlags.nativeBiometrics) return false;
  const v = await AsyncStorage.getItem(ENABLED_KEY);
  return v === '1';
}

export async function setBiometricUnlockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  trackNative('biometric_session', { action: 'settings', enabled });
}

export async function setFallbackPin(pin: string): Promise<void> {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must be 4–8 digits');
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

export async function verifyFallbackPin(pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  const ok = Boolean(stored && stored === pin);
  trackNative('biometric_session', { action: 'pin_fallback', success: ok });
  return ok;
}

export async function hasFallbackPin(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  return Boolean(stored);
}

export async function authenticateBiometric(prompt = 'Unlock Dalily'): Promise<boolean> {
  if (!(await isBiometricUnlockEnabled())) return false;
  const cap = await getBiometricCapability();
  if (!cap.hardware || !cap.enrolled) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    cancelLabel: 'Cancel',
    fallbackLabel: 'Use PIN',
    disableDeviceFallback: false,
  });
  trackNative('biometric_session', {
    action: 'authenticate',
    success: result.success,
    label: cap.label,
  });
  if (result.success) {
    await SecureStore.setItemAsync(SESSION_KEY, String(Date.now()));
  }
  return result.success;
}

/** Secure re-authentication for sensitive actions (payments, docs). */
export async function requireSecureReauth(prompt = 'Confirm it is you'): Promise<boolean> {
  const bio = await authenticateBiometric(prompt);
  if (bio) return true;
  // Caller should show PIN sheet when this returns false and hasFallbackPin().
  return false;
}

export async function getLastBiometricSessionAt(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function clearBiometricSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
