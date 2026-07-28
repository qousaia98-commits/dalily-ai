import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { Loading } from '@/components/ui';
import { featureFlags } from '@/constants/env';
import { useTheme } from '@/theme/ThemeProvider';
import { hydrateProviderJobsCache } from '@/features/provider/services';

export default function ProviderLayout() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { colors } = useTheme();

  useEffect(() => {
    void hydrateProviderJobsCache();
  }, []);

  if (!hydrated) return <Loading />;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (!featureFlags.providerApp) return <Redirect href="/(auth)/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="jobs/[id]" options={{ title: 'Job' }} />
      <Stack.Screen name="assistant" options={{ title: 'Business Assistant' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Stack.Screen name="availability" options={{ title: 'Availability' }} />
      <Stack.Screen name="native" options={{ title: 'Native features' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
    </Stack>
  );
}
