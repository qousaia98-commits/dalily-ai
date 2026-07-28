import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { Loading } from '@/components/ui';
import { featureFlags } from '@/constants/env';
import { useFavoritesStore, useSearchStore } from '@/store/customer';
import { useTheme } from '@/theme/ThemeProvider';

export default function CustomerLayout() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrateFav = useFavoritesStore((s) => s.hydrate);
  const hydrateSearch = useSearchStore((s) => s.hydrate);
  const { colors } = useTheme();

  useEffect(() => {
    void hydrateFav();
    void hydrateSearch();
  }, [hydrateFav, hydrateSearch]);

  if (!hydrated) return <Loading />;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (!featureFlags.customerApp) return <Redirect href="/(auth)/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="categories/index" options={{ title: 'Categories' }} />
      <Stack.Screen name="categories/[id]" options={{ title: 'Category' }} />
      <Stack.Screen name="providers/[id]" options={{ title: 'Provider' }} />
      <Stack.Screen name="book/[providerId]" options={{ title: 'Book' }} />
      <Stack.Screen name="bookings/[id]" options={{ title: 'Booking' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="native" options={{ title: 'Native features' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
    </Stack>
  );
}
