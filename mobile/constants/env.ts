/**
 * Environment separation — development / staging / production.
 */

import Constants from 'expo-constants';

export type AppEnvironment = 'development' | 'staging' | 'production';

function truthy(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw === '') return fallback;
  const v = raw.toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function resolveAppEnv(): AppEnvironment {
  const fromExtra = Constants.expoConfig?.extra?.appEnv as string | undefined;
  const raw = (
    process.env.EXPO_PUBLIC_APP_ENV ??
    process.env.APP_ENV ??
    fromExtra ??
    'development'
  ).toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'staging' || raw === 'preview') return 'staging';
  return 'development';
}

export const appEnv: AppEnvironment = resolveAppEnv();

export const env = {
  appEnv,
  isDev: appEnv === 'development' || (typeof __DEV__ !== 'undefined' && __DEV__),
  isStaging: appEnv === 'staging',
  isProduction: appEnv === 'production',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (appEnv === 'production'
      ? 'https://api.dalily.app/v1'
      : appEnv === 'staging'
        ? 'https://staging-api.dalily.app/v1'
        : 'https://api.dalily.app/v1'),
  appUrl: process.env.EXPO_PUBLIC_APP_URL ?? 'https://dalily.app',
  apiVersion: process.env.EXPO_PUBLIC_API_VERSION ?? 'v1',
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  analyticsKey: process.env.EXPO_PUBLIC_ANALYTICS_KEY ?? '',
  privacyUrl:
    (Constants.expoConfig?.extra?.privacyUrl as string | undefined) ??
    'https://dalily.app/privacy',
  termsUrl:
    (Constants.expoConfig?.extra?.termsUrl as string | undefined) ?? 'https://dalily.app/terms',
  marketingUrl:
    (Constants.expoConfig?.extra?.marketingUrl as string | undefined) ?? 'https://dalily.app',
  supportUrl:
    (Constants.expoConfig?.extra?.supportUrl as string | undefined) ??
    'https://dalily.app/support',
  supportEmail:
    (Constants.expoConfig?.extra?.supportEmail as string | undefined) ?? 'support@dalily.app',
  releaseChannel: process.env.EXPO_PUBLIC_RELEASE_CHANNEL ?? appEnv,
} as const;

export const featureFlags = {
  customerApp: truthy(process.env.EXPO_PUBLIC_FF_CUSTOMER_APP, true),
  providerApp: truthy(process.env.EXPO_PUBLIC_FF_PROVIDER_APP, true),
  offlineQueue: truthy(process.env.EXPO_PUBLIC_FF_OFFLINE_QUEUE, true),
  biometricPrep: truthy(process.env.EXPO_PUBLIC_FF_BIOMETRIC_PREP, true),
  sentry: truthy(process.env.EXPO_PUBLIC_FF_SENTRY, appEnv === 'production'),
  pushPrep: truthy(process.env.EXPO_PUBLIC_FF_PUSH_PREP, true),
  customerAi: truthy(process.env.EXPO_PUBLIC_FF_CUSTOMER_AI, true),
  voiceSearchPrep: truthy(process.env.EXPO_PUBLIC_FF_VOICE_SEARCH_PREP, true),
  providerAi: truthy(process.env.EXPO_PUBLIC_FF_PROVIDER_AI, true),
  providerAssistant: truthy(process.env.EXPO_PUBLIC_FF_PROVIDER_ASSISTANT, true),
  nativeFeatures: truthy(process.env.EXPO_PUBLIC_FF_NATIVE_FEATURES, true),
  nativePush: truthy(process.env.EXPO_PUBLIC_FF_NATIVE_PUSH, true),
  nativeCamera: truthy(process.env.EXPO_PUBLIC_FF_NATIVE_CAMERA, true),
  nativeLocation: truthy(process.env.EXPO_PUBLIC_FF_NATIVE_LOCATION, true),
  nativeMaps: truthy(process.env.EXPO_PUBLIC_FF_NATIVE_MAPS, true),
  nativeBiometrics: truthy(process.env.EXPO_PUBLIC_FF_NATIVE_BIOMETRICS, true),
  nativeOfflineMedia: truthy(process.env.EXPO_PUBLIC_FF_NATIVE_OFFLINE_MEDIA, true),
  analytics: truthy(process.env.EXPO_PUBLIC_FF_ANALYTICS, appEnv !== 'development'),
  otaUpdates: truthy(process.env.EXPO_PUBLIC_FF_OTA_UPDATES, appEnv !== 'development'),
  consentGate: truthy(process.env.EXPO_PUBLIC_FF_CONSENT_GATE, true),
  /** WebView bridge into deployed web request → find → offers → unlock → chat. Default off. */
  webRequestFlow: truthy(process.env.EXPO_PUBLIC_FF_WEB_REQUEST_FLOW, false),
} as const;

export type FeatureFlagKey = keyof typeof featureFlags;

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  return featureFlags[key];
}
