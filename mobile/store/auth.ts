import { create } from 'zustand';

export type AuthUser = {
  id: string;
  email: string | null;
  roles: string[];
};

type AuthState = {
  hydrated: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  setHydrated: (hydrated: boolean) => void;
  setSession: (user: AuthUser | null) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  hydrated: false,
  isAuthenticated: false,
  user: null,
  setHydrated: (hydrated) => set({ hydrated }),
  setSession: (user) =>
    set({
      user,
      isAuthenticated: Boolean(user),
    }),
  clear: () => set({ user: null, isAuthenticated: false }),
}));
