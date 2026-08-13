import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeNotification } from '../types';

const KEY = 'dalily.native.push.history';
const MAX = 100;

export async function listNotificationHistory(): Promise<NativeNotification[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as NativeNotification[];
  } catch {
    return [];
  }
}

export async function appendNotification(
  item: Omit<NativeNotification, 'id' | 'receivedAt' | 'read'>,
): Promise<NativeNotification> {
  const entry: NativeNotification = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: Date.now(),
    read: false,
  };
  const list = await listNotificationHistory();
  list.unshift(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  return entry;
}

export async function markNotificationRead(id: string): Promise<void> {
  const list = await listNotificationHistory();
  const next = list.map((n) => (n.id === id ? { ...n, read: true } : n));
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function clearNotificationHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
