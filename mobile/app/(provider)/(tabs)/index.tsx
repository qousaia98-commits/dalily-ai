import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Card, Badge, Skeleton, Button } from '@/components/ui';
import { JobCard } from '@/features/provider';
import {
  fetchProviderDashboard,
  fetchProviderAiInsights,
} from '@/features/provider/services';
import { SectionHeader } from '@/features/customer';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, radii } from '@/theme/tokens';
import { featureFlags } from '@/constants/env';
import { useSettingsStore } from '@/store/settings';
import { useOfflineStore } from '@/store/offline';

export default function ProviderDashboardScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const language = useSettingsStore((s) => s.language);
  const queueSize = useOfflineStore((s) => s.queueSize);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['provider', 'dashboard'],
    queryFn: fetchProviderDashboard,
  });
  const ai = useQuery({
    queryKey: ['provider', 'ai'],
    queryFn: fetchProviderAiInsights,
    enabled: featureFlags.providerAi,
  });

  if (isLoading || !data) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Skeleton height={28} />
        <Skeleton height={120} />
        <Skeleton height={80} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
      >
        <Text variant="title">{data.providerName}</Text>
        <Text muted>{t('providerApp.dashboard.subtitle')}</Text>

        <View style={styles.kpiRow}>
          <Card style={styles.kpi}>
            <Text variant="caption" muted>
              {t('providerApp.dashboard.health')}
            </Text>
            <Text variant="title">{Math.round(data.businessHealthScore * 100)}%</Text>
          </Card>
          <Card style={styles.kpi}>
            <Text variant="caption" muted>
              {t('providerApp.dashboard.revenueToday')}
            </Text>
            <Text variant="title">
              {data.revenueToday} {data.currency}
            </Text>
          </Card>
        </View>

        <Card style={styles.card}>
          <Text variant="subtitle">{t('providerApp.dashboard.assistant')}</Text>
          <Text muted>
            {language === 'ar' ? data.assistantSummaryAr : data.assistantSummaryEn}
          </Text>
          <Badge
            label={`${data.pendingRecommendations} ${t('providerApp.dashboard.pendingRecs')}`}
            tone="warning"
          />
          {featureFlags.providerAssistant ? (
            <Button
              title={t('providerApp.dashboard.openAssistant')}
              onPress={() => router.push('/(provider)/assistant')}
            />
          ) : null}
        </Card>

        <SectionHeader title={t('providerApp.dashboard.today')} />
        <View style={{ gap: spacing.sm }}>
          {data.todaySchedule.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onPress={() => router.push(`/(provider)/jobs/${job.id}`)}
            />
          ))}
          {data.todaySchedule.length === 0 ? <Text muted>{t('common.empty')}</Text> : null}
        </View>

        <SectionHeader title={t('providerApp.dashboard.performance')} />
        <Card style={styles.card}>
          <Text>
            {t('providerApp.analytics.completion')}:{' '}
            {Math.round(data.performance.completionRate * 100)}%
          </Text>
          <Text>
            {t('providerApp.analytics.response')}: {data.performance.responseTimeMin}m
          </Text>
          <Text>
            {t('providerApp.analytics.rating')}: {data.performance.rating.toFixed(1)}
          </Text>
          <Text>
            {t('providerApp.analytics.capacity')}:{' '}
            {Math.round(data.performance.capacityUsage * 100)}%
          </Text>
        </Card>

        {featureFlags.providerAi && ai.data?.length ? (
          <>
            <SectionHeader title={t('providerApp.dashboard.aiInsights')} />
            {ai.data.slice(0, 3).map((insight) => (
              <Card key={insight.code} style={{ marginBottom: spacing.sm }}>
                <Badge label={insight.kind} tone="info" />
                <Text style={{ marginTop: spacing.xs }}>
                  {language === 'ar' ? insight.labelAr : insight.labelEn}
                </Text>
              </Card>
            ))}
          </>
        ) : null}

        <SectionHeader title={t('providerApp.dashboard.quickActions')} />
        <View style={styles.quickRow}>
          {[
            { label: t('providerApp.tabs.jobs'), href: '/(provider)/(tabs)/jobs' },
            { label: t('providerApp.tabs.calendar'), href: '/(provider)/(tabs)/calendar' },
            { label: t('providerApp.dashboard.analytics'), href: '/(provider)/analytics' },
            { label: t('providerApp.tabs.messages'), href: '/(provider)/(tabs)/messages' },
          ].map((a) => (
            <Pressable
              key={a.href}
              onPress={() => router.push(a.href as `/(provider)/${string}`)}
              style={[styles.quick, { backgroundColor: colors.surfaceMuted }]}
            >
              <Text variant="caption">{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {queueSize > 0 ? (
          <Text muted>
            {t('providerApp.offline.queued')}: {queueSize}
          </Text>
        ) : null}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('providerApp.dashboard.fab')}
        onPress={() => router.push('/(provider)/(tabs)/jobs')}
        style={[styles.fab, { backgroundColor: colors.primary }]}
      >
        <Text style={{ color: colors.primaryText, fontWeight: '700' }}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, gap: spacing.md },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 100 },
  kpiRow: { flexDirection: 'row', gap: spacing.sm },
  kpi: { flex: 1, gap: spacing.xs },
  card: { gap: spacing.sm },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quick: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
