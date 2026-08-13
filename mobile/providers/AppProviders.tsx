import React, { useEffect } from 'react';
import { AppState, I18nManager } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { bootstrapAuth } from '@/services/auth/auth-service';
import { refreshNetworkStatus, syncOfflineQueue } from '@/services/offline/sync';
import { applyLanguage, i18n } from '@/i18n';
import { useSettingsStore } from '@/store/settings';
import { QUERY_STALE_MS } from '@/constants/config';
import { bootstrapObservability, logFeatureFlag } from '@/lib/observability';
import { featureFlags } from '@/constants/env';
import { startAnalyticsSession, endAnalyticsSession } from '@/lib/analytics';
import { checkForOtaUpdate } from '@/lib/ota';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_MS,
      retry: 1,
      refetchOnReconnect: true,
    },
  },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  const language = useSettingsStore((s) => s.language);

  useEffect(() => {
    bootstrapObservability();
    void bootstrapAuth();
    void startAnalyticsSession();
    void refreshNetworkStatus().then((online) => {
      if (online) void syncOfflineQueue();
    });
    void checkForOtaUpdate();
    (Object.keys(featureFlags) as (keyof typeof featureFlags)[]).forEach((key) => {
      logFeatureFlag(key, featureFlags[key]);
    });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') endAnalyticsSession();
      if (state === 'active') void startAnalyticsSession();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    void i18n.changeLanguage(language);
    const rtl = language === 'ar';
    if (I18nManager.isRTL !== rtl) {
      I18nManager.allowRTL(rtl);
      I18nManager.forceRTL(rtl);
    }
  }, [language]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export { applyLanguage };
