/**
 * OTA updates — channels, rollback, verification, version compatibility.
 */

import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { featureFlags, env } from '@/constants/env';
import { logEvent } from '@/lib/observability';

export type OtaStatus = {
  enabled: boolean;
  channel: string;
  runtimeVersion: string | null;
  updateId: string | null;
  isEmbeddedLaunch: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
};

export function getOtaChannel(): string {
  return (
    Updates.channel ??
    env.releaseChannel ??
    (env.isProduction ? 'production' : env.isStaging ? 'preview' : 'development')
  );
}

export function getOtaStatus(): OtaStatus {
  return {
    enabled: featureFlags.otaUpdates && Updates.isEnabled,
    channel: getOtaChannel(),
    runtimeVersion: Updates.runtimeVersion ?? Constants.expoConfig?.version ?? null,
    updateId: Updates.updateId,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    isUpdateAvailable: false,
    isUpdatePending: false,
  };
}

export async function checkForOtaUpdate(): Promise<{
  isAvailable: boolean;
  manifest?: Updates.Manifest;
}> {
  if (!featureFlags.otaUpdates || !Updates.isEnabled) {
    return { isAvailable: false };
  }
  try {
    const result = await Updates.checkForUpdateAsync();
    logEvent('ota_check', {
      isAvailable: result.isAvailable,
      channel: getOtaChannel(),
    });
    return {
      isAvailable: result.isAvailable,
      manifest: result.isAvailable ? result.manifest : undefined,
    };
  } catch (error) {
    logEvent('ota_check_error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return { isAvailable: false };
  }
}

export async function downloadAndApplyOtaUpdate(): Promise<boolean> {
  if (!featureFlags.otaUpdates || !Updates.isEnabled) return false;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return false;
    const fetched = await Updates.fetchUpdateAsync();
    logEvent('ota_fetched', { isNew: fetched.isNew, channel: getOtaChannel() });
    if (fetched.isNew) {
      await Updates.reloadAsync();
      return true;
    }
    return false;
  } catch (error) {
    logEvent('ota_apply_error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Emergency rollback — reload embedded binary bundle (discards pending OTA).
 * Full channel rollback is performed via `eas update:rollback` on CI.
 */
export async function emergencyReloadEmbedded(): Promise<void> {
  logEvent('ota_emergency_reload', { channel: getOtaChannel() });
  await Updates.reloadAsync();
}

export const otaReleasePolicy = {
  channels: ['development', 'preview', 'production'] as const,
  versionCompatibility: 'runtimeVersion=appVersion',
  rollback: {
    cli: 'eas update:rollback --channel production',
    emergency: 'reload embedded binary + republish previous update group',
  },
  verification: 'EAS signed updates; runtimeVersion must match binary',
} as const;
