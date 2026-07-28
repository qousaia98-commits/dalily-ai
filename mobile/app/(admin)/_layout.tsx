import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { Loading } from '@/components/ui';

/** Admin stack — future marketplace ops console. */
export default function AdminLayout() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const roles = useAuthStore((s) => s.user?.roles ?? []);

  if (!hydrated) return <Loading />;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (!roles.includes('admin')) return <Redirect href="/" />;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Admin' }} />
    </Stack>
  );
}
