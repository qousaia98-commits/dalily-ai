import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { Text, ErrorState } from '@/components/ui';
import { env, featureFlags } from '@/constants/env';
import {
  buildMobileBridgeWebViewUrl,
  shouldOpenExternally,
} from '@/services/web-bridge';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Phase = 'issuing' | 'ready' | 'error';

/**
 * Full-screen WebView bridge into the deployed web marketplace flow
 * (request → find → offers → unlock → chat). Thin wrapper — no domain reimplementation.
 */
export default function WebRequestFlowScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ target?: string }>();
  const target =
    typeof params.target === 'string' && params.target.startsWith('/')
      ? params.target
      : '/request/new';

  const [phase, setPhase] = useState<Phase>('issuing');
  const [bridgeUrl, setBridgeUrl] = useState<string | null>(null);
  const [webLoading, setWebLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string>('customer.webRequest.error');
  const issueGen = useRef(0);

  const closeToNative = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(customer)/(tabs)');
    }
  }, []);

  const issueBridge = useCallback(async () => {
    const gen = ++issueGen.current;
    setPhase('issuing');
    setBridgeUrl(null);
    setWebLoading(true);
    const result = await buildMobileBridgeWebViewUrl(target);
    if (gen !== issueGen.current) return;
    if (!result.ok) {
      setErrorKey(
        result.error === 'no_session'
          ? 'customer.webRequest.noSession'
          : 'customer.webRequest.error',
      );
      setPhase('error');
      return;
    }
    setBridgeUrl(result.url);
    setPhase('ready');
  }, [target]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async setup fetch, setState happens post-await
    void issueBridge();
  }, [issueBridge]);

  const onShouldStartLoadWithRequest = useCallback((req: { url: string }) => {
    if (shouldOpenExternally(req.url, env.appUrl)) {
      void Linking.openURL(req.url);
      return false;
    }
    return true;
  }, []);

  if (!featureFlags.webRequestFlow) {
    return <Redirect href="/(customer)/(tabs)" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('customer.webRequest.title'),
          headerLeft: () => (
            <Pressable
              onPress={closeToNative}
              accessibilityRole="button"
              accessibilityLabel={t('customer.webRequest.close')}
              hitSlop={12}
              style={styles.headerBtn}
            >
              <Text style={{ color: colors.primary }}>{t('customer.webRequest.close')}</Text>
            </Pressable>
          ),
        }}
      />
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {phase === 'issuing' ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text muted>{t('customer.webRequest.loading')}</Text>
          </View>
        ) : null}

        {phase === 'error' ? (
          <ErrorState message={t(errorKey)} onRetry={() => void issueBridge()} />
        ) : null}

        {phase === 'ready' && bridgeUrl ? (
          <>
            {webLoading ? (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            ) : null}
            <WebView
              source={{ uri: bridgeUrl }}
              style={styles.webview}
              onLoadStart={() => setWebLoading(true)}
              onLoadEnd={() => setWebLoading(false)}
              onError={() => {
                setErrorKey('customer.webRequest.loadFailed');
                setPhase('error');
              }}
              onHttpError={() => {
                setErrorKey('customer.webRequest.loadFailed');
                setPhase('error');
              }}
              onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
              startInLoadingState
              setSupportMultipleWindows={false}
              // Android: allow third-party cookies for Supabase SSR session
              thirdPartyCookiesEnabled={Platform.OS === 'android'}
              sharedCookiesEnabled
            />
          </>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webview: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  headerBtn: { paddingHorizontal: spacing.sm },
});
