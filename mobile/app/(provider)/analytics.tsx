import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Card, Skeleton, Badge } from '@/components/ui';
import { MiniBars } from '@/features/provider';
import { fetchAnalytics, fetchProviderAiInsights } from '@/features/provider/services';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { featureFlags } from '@/constants/env';
import { useSettingsStore } from '@/store/settings';

export default function ProviderAnalyticsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const language = useSettingsStore((s) => s.language);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['provider', 'analytics'],
    queryFn: fetchAnalytics,
  });
  const ai = useQuery({
    queryKey: ['provider', 'ai'],
    queryFn: fetchProviderAiInsights,
    enabled: featureFlags.providerAi,
  });

  if (isLoading || !data) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Skeleton height={200} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
      }
    >
      <View style={styles.grid}>
        {[
          { label: t('providerApp.analytics.revenue'), value: `${data.revenue}` },
          { label: t('providerApp.analytics.bookings'), value: `${data.bookings}` },
          { label: t('providerApp.analytics.rating'), value: data.rating.toFixed(1) },
          {
            label: t('providerApp.analytics.completion'),
            value: `${Math.round(data.completionRate * 100)}%`,
          },
          {
            label: t('providerApp.analytics.response'),
            value: `${data.responseTimeMin}m`,
          },
          {
            label: t('providerApp.analytics.repeat'),
            value: `${data.repeatCustomers}`,
          },
          {
            label: t('providerApp.analytics.capacity'),
            value: `${Math.round(data.capacityUsage * 100)}%`,
          },
          {
            label: t('providerApp.analytics.forecast'),
            value: `${Math.round(data.forecastDemand * 100)}%`,
          },
        ].map((k) => (
          <Card key={k.label} style={styles.kpi}>
            <Text variant="caption" muted>
              {k.label}
            </Text>
            <Text variant="subtitle">{k.value}</Text>
          </Card>
        ))}
      </View>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.analytics.weekly')}</Text>
        <MiniBars data={data.series.map((s) => ({ label: s.label, value: s.revenue }))} />
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.analytics.pricingTrend')}</Text>
        <Text muted>{Math.round(data.pricingTrend * 100)}%</Text>
      </Card>

      {featureFlags.providerAi && ai.data?.length ? (
        <Card style={styles.card}>
          <Text variant="subtitle">{t('providerApp.dashboard.aiInsights')}</Text>
          {ai.data.map((i) => (
            <View key={i.code} style={{ marginTop: spacing.sm }}>
              <Badge label={i.kind} tone="info" />
              <Text muted>{language === 'ar' ? i.labelAr : i.labelEn}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: { width: '47%', gap: spacing.xxs },
  card: { gap: spacing.sm },
});
