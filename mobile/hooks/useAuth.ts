import { useAuthStore } from '@/store/auth';

export function useAuth() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  return { hydrated, isAuthenticated, user };
}
