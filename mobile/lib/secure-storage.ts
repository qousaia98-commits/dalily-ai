import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SECURE_STORE_KEYS } from '@/constants/config';

const memory = new Map<string, string>();

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    memory.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return memory.get(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    memory.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
};

export async function saveSession(session: StoredSession): Promise<void> {
  await setItem(SECURE_STORE_KEYS.accessToken, session.accessToken);
  await setItem(SECURE_STORE_KEYS.refreshToken, session.refreshToken);
  await setItem(
    SECURE_STORE_KEYS.sessionMeta,
    JSON.stringify({ expiresAt: session.expiresAt ?? null }),
  );
}

export async function loadSession(): Promise<StoredSession | null> {
  const accessToken = await getItem(SECURE_STORE_KEYS.accessToken);
  const refreshToken = await getItem(SECURE_STORE_KEYS.refreshToken);
  if (!accessToken || !refreshToken) return null;
  const metaRaw = await getItem(SECURE_STORE_KEYS.sessionMeta);
  let expiresAt: number | undefined;
  if (metaRaw) {
    try {
      const parsed = JSON.parse(metaRaw) as { expiresAt?: number | null };
      expiresAt = parsed.expiresAt ?? undefined;
    } catch {
      /* ignore */
    }
  }
  return { accessToken, refreshToken, expiresAt };
}

export async function clearSession(): Promise<void> {
  await deleteItem(SECURE_STORE_KEYS.accessToken);
  await deleteItem(SECURE_STORE_KEYS.refreshToken);
  await deleteItem(SECURE_STORE_KEYS.sessionMeta);
}
