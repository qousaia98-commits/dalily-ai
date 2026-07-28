import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Card, Button, Badge, Skeleton } from '@/components/ui';
import { fetchProviderProfile } from '@/features/provider/services';
import { logout } from '@/services/auth/auth-service';
import { applyLanguage } from '@/i18n';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function ProviderProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const language = useSettingsStore((s) => s.language);
  const { data, isLoading } = useQuery({
    queryKey: ['provider', 'profile'],
    queryFn: fetchProviderProfile,
  });

  if (isLoading || !data) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Skeleton height={160} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text variant="title" style={{ flex: 1 }}>
            {data.businessName}
          </Text>
          {data.verified ? <Badge label="Verified" tone="success" /> : null}
        </View>
        <Text muted>
          {t('providerApp.profile.trust')}: {Math.round(data.trustScore * 100)}%
        </Text>
        <Text>{language === 'ar' ? data.aboutAr : data.aboutEn}</Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.profile.services')}</Text>
        {data.services.map((s) => (
          <Text key={s.id} muted>
            {s.title} · from {s.priceFrom} JOD
          </Text>
        ))}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.profile.documents')}</Text>
        {data.documents.map((d) => (
          <Text key={d.id} muted>
            {d.label}: {d.status}
          </Text>
        ))}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.profile.gallery')}</Text>
        <Text muted>
          {data.galleryCount} {t('providerApp.profile.photos')}
        </Text>
      </Card>

      <Button
        title={t('providerApp.calendar.manageAvailability')}
        variant="secondary"
        onPress={() => router.push('/(provider)/availability')}
      />
      <Button
        title={t('native.open')}
        variant="secondary"
        onPress={() => router.push('/(provider)/native')}
      />
      <Button
        title={t('legal.privacyTitle')}
        variant="ghost"
        onPress={() => router.push('/(provider)/privacy')}
      />
      <Button
        title={t('providerApp.dashboard.analytics')}
        variant="ghost"
        onPress={() => router.push('/(provider)/analytics')}
      />

      <View style={styles.row}>
        <Button title="EN" variant={language === 'en' ? 'primary' : 'ghost'} onPress={() => applyLanguage('en')} />
        <Button title="AR" variant={language === 'ar' ? 'primary' : 'ghost'} onPress={() => applyLanguage('ar')} />
      </View>

      <Button
        title={t('auth.logout')}
        variant="danger"
        onPress={async () => {
          await logout();
          router.replace('/(auth)/login');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
});
