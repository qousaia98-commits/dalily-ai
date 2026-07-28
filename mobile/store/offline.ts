import { create } from 'zustand';

type OfflineState = {
  isOnline: boolean;
  queueSize: number;
  setOnline: (isOnline: boolean) => void;
  setQueueSize: (queueSize: number) => void;
};

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: true,
  queueSize: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setQueueSize: (queueSize) => set({ queueSize }),
}));
