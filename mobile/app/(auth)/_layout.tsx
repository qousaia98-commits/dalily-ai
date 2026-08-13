import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { Loading } from '@/components/ui';

export default function AuthLayout() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!hydrated) return <Loading />;
  if (isAuthenticated) return <Redirect href="/" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
