import { create } from 'zustand';

type UserProfileState = {
  displayName: string | null;
  avatarUrl: string | null;
  providerId: string | null;
  setProfile: (input: Partial<Omit<UserProfileState, 'setProfile' | 'clear'>>) => void;
  clear: () => void;
};

export const useUserStore = create<UserProfileState>((set) => ({
  displayName: null,
  avatarUrl: null,
  providerId: null,
  setProfile: (input) => set(input),
  clear: () => set({ displayName: null, avatarUrl: null, providerId: null }),
}));
