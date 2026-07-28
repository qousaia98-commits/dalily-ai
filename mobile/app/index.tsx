import { Redirect } from 'expo-router';
import { Loading } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { featureFlags } from '@/constants/env';

export default function Index() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (!hydrated) return <Loading />;

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const roles = user?.roles ?? [];
  if (roles.includes('admin')) {
    return <Redirect href="/(admin)" />;
  }
  if (roles.includes('business') && featureFlags.providerApp) {
    return <Redirect href="/(provider)/(tabs)" />;
  }
  if (featureFlags.customerApp) {
    return <Redirect href="/(customer)/(tabs)" />;
  }
  return <Redirect href="/(auth)/login" />;
}
