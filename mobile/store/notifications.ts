import { create } from 'zustand';

type NotificationState = {
  unreadCount: number;
  pushPermission: 'unknown' | 'granted' | 'denied';
  setUnreadCount: (unreadCount: number) => void;
  setPushPermission: (pushPermission: NotificationState['pushPermission']) => void;
};

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  pushPermission: 'unknown',
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setPushPermission: (pushPermission) => set({ pushPermission }),
}));
