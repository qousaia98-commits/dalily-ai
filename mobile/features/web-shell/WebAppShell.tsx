import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, BackHandler } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { Text, ErrorState } from '@/components/ui';
import { env } from '@/constants/env';
import { buildMobileBridgeWebViewUrl, shouldOpenExternally } from '@/services/web-bridge';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Phase = 'issuing' | 'ready' | 'error';

/**
 * Full-screen web-app shell — the native app defers entirely to the real,
 * already-designed web app for UI/functionality after login. The web app
 * has its own responsive chrome (its own bottom nav, cards, etc.), so this
 * renders edge-to-edge with no native header/tab bar layered on top.
 */
export function WebAppShell({ target = '/' }: { target?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // react-native-webview's ref type is imprecise (RefAttributes<unknown>)
  // and fights strict generics here — .goBack()/.goForward() exist at runtime.
  const webviewRef = useRef<any>(null);
  const canGoBackRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('issuing');
  const [bridgeUrl, setBridgeUrl] = useState<string | null>(null);
  const [webLoading, setWebLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string>('customer.webRequest.error');
  const issueGen = useRef(0);

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

  // Hardware back button navigates web history instead of exiting/going native.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current) {
        webviewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const onShouldStartLoadWithRequest = useCallback((req: { url: string }) => {
    if (shouldOpenExternally(req.url, env.appUrl)) {
      void Linking.openURL(req.url);
      return false;
    }
    return true;
  }, []);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
  }, []);

  return (
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
            ref={webviewRef}
            source={{ uri: bridgeUrl }}
            style={styles.webview}
            onLoadStart={() => setWebLoading(true)}
            onLoadEnd={() => setWebLoading(false)}
            onNavigationStateChange={onNavigationStateChange}
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
});
