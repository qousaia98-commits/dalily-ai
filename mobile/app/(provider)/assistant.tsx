import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Card, Button, Badge, Skeleton } from '@/components/ui';
import {
  fetchAssistantSnapshot,
  decideRecommendation,
} from '@/features/provider/services';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settings';
import { featureFlags } from '@/constants/env';
import { SectionHeader } from '@/features/customer';

export default function ProviderAssistantScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const language = useSettingsStore((s) => s.language);
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['provider', 'assistant'],
    queryFn: fetchAssistantSnapshot,
    enabled: featureFlags.providerAssistant,
  });

  if (!featureFlags.providerAssistant) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text>{t('providerApp.assistant.disabled')}</Text>
      </View>
    );
  }

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
      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.assistant.briefing')}</Text>
        <Text>{language === 'ar' ? data.briefingAr : data.briefingEn}</Text>
        <Badge
          label={`${t('providerApp.dashboard.health')} ${Math.round(data.healthScore * 100)}%`}
          tone="success"
        />
      </Card>

      <SectionHeader title={t('providerApp.assistant.insights')} />
      {data.insights.map((i) => (
        <Card key={i.code} style={{ marginBottom: spacing.sm }}>
          <Badge label={i.severity} tone={i.severity === 'positive' ? 'success' : 'info'} />
          <Text style={{ marginTop: spacing.xs }}>
            {language === 'ar' ? i.labelAr : i.labelEn}
          </Text>
        </Card>
      ))}

      <SectionHeader title={t('providerApp.assistant.recommendations')} />
      {data.recommendations.map((r) => (
        <Card key={r.id} style={{ marginBottom: spacing.sm, gap: spacing.sm }}>
          <Text variant="subtitle">{language === 'ar' ? r.titleAr : r.titleEn}</Text>
          <Text muted>{r.bodyEn}</Text>
          <Badge label={r.status} tone={r.status === 'pending' ? 'warning' : 'success'} />
          {r.status === 'pending' ? (
            <View style={styles.row}>
              <Button
                title={t('providerApp.assistant.accept')}
                onPress={async () => {
                  await decideRecommendation(r.id, true);
                  await qc.invalidateQueries({ queryKey: ['provider', 'assistant'] });
                }}
              />
              <Button
                title={t('providerApp.assistant.dismiss')}
                variant="ghost"
                onPress={async () => {
                  await decideRecommendation(r.id, false);
                  await qc.invalidateQueries({ queryKey: ['provider', 'assistant'] });
                }}
              />
            </View>
          ) : null}
        </Card>
      ))}

      <SectionHeader title={t('providerApp.assistant.goals')} />
      {data.goals.map((g) => (
        <Card key={g.id} style={{ marginBottom: spacing.sm }}>
          <Text>{g.title}</Text>
          <Text muted>
            {g.current}/{g.target} · {Math.round(g.progressPct * 100)}%
          </Text>
        </Card>
      ))}

      <SectionHeader title={t('providerApp.assistant.growth')} />
      {data.growth.map((g) => (
        <Card key={g.code} style={{ marginBottom: spacing.sm }}>
          <Text>{language === 'ar' ? g.titleAr : g.titleEn}</Text>
        </Card>
      ))}

      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.assistant.benchmark')}</Text>
        <Text muted>
          {data.benchmark.cohort} · p{Math.round(data.benchmark.percentile * 100)}
        </Text>
      </Card>

      <SectionHeader title={t('providerApp.assistant.history')} />
      {data.history.map((h) => (
        <Text key={h.id} muted>
          {h.titleEn} · {h.status}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
