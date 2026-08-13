import { useOfflineStore } from '@/store/offline';

export function useOffline() {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const queueSize = useOfflineStore((s) => s.queueSize);
  return { isOnline, queueSize };
}
