import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, Card, Button } from '@/components/ui';
import {
  loadConsent,
  saveConsent,
  acceptLegalDocuments,
  requestAccountDeletion,
  requestDataExport,
  openPrivacyPolicy,
  openTermsOfService,
  needsConsentGate,
  type ConsentState,
} from '@/lib/privacy';
import { env } from '@/constants/env';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    void loadConsent().then(setConsent);
  }, []);

  if (!consent) {
    return <View style={[styles.root, { backgroundColor: colors.background }]} />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <Text variant="title">{t('legal.privacyTitle')}</Text>
        <Text muted>{t('legal.privacySubtitle')}</Text>
        {needsConsentGate(consent) ? (
          <Button
            title={t('legal.accept')}
            onPress={async () => setConsent(await acceptLegalDocuments())}
          />
        ) : (
          <Text muted>{t('legal.accepted')}</Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('legal.preferences')}</Text>
        <View style={styles.row}>
          <Text style={{ flex: 1 }}>{t('legal.analytics')}</Text>
          <Switch
            value={consent.analytics}
            onValueChange={async (v) => {
              const next = { ...consent, analytics: v };
              await saveConsent(next);
              setConsent(next);
            }}
          />
        </View>
        <View style={styles.row}>
          <Text style={{ flex: 1 }}>{t('legal.crashReporting')}</Text>
          <Switch
            value={consent.crashReporting}
            onValueChange={async (v) => {
              const next = { ...consent, crashReporting: v };
              await saveConsent(next);
              setConsent(next);
            }}
          />
        </View>
        <View style={styles.row}>
          <Text style={{ flex: 1 }}>{t('legal.marketing')}</Text>
          <Switch
            value={consent.marketing}
            onValueChange={async (v) => {
              const next = { ...consent, marketing: v };
              await saveConsent(next);
              setConsent(next);
            }}
          />
        </View>
      </Card>

      <Button title={t('legal.openPrivacy')} variant="secondary" onPress={() => void openPrivacyPolicy()} />
      <Button title={t('legal.openTerms')} variant="ghost" onPress={() => void openTermsOfService()} />
      <Button
        title={t('legal.exportData')}
        variant="ghost"
        onPress={async () => {
          const { requestId } = await requestDataExport();
          Alert.alert(t('legal.exportData'), requestId);
        }}
      />
      <Button
        title={t('legal.deleteAccount')}
        variant="danger"
        onPress={async () => {
          const { requestId } = await requestAccountDeletion();
          Alert.alert(t('legal.deleteAccount'), `${t('legal.deleteQueued')}\n${requestId}`);
        }}
      />
      <Text muted>
        {env.supportEmail} · {env.supportUrl}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
