import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Card, Button, Skeleton } from '@/components/ui';
import { fetchCalendarBlocks, fetchAvailability } from '@/features/provider/services';
import type { CalendarView } from '@/features/provider/types';
import { useProviderUiStore } from '@/store/provider';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const VIEWS: CalendarView[] = ['day', 'week', 'month'];

export default function ProviderCalendarScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const view = useProviderUiStore((s) => s.calendarView);
  const setView = useProviderUiStore((s) => s.setCalendarView);
  const blocks = useQuery({
    queryKey: ['provider', 'calendar'],
    queryFn: fetchCalendarBlocks,
  });
  const availability = useQuery({
    queryKey: ['provider', 'availability'],
    queryFn: fetchAvailability,
  });

  const filtered = useMemo(() => {
    const list = blocks.data ?? [];
    // eslint-disable-next-line react-hooks/purity -- intentional "as of render" snapshot for day/week filtering
    const now = Date.now();
    if (view === 'day') {
      return list.filter((b) => {
        const d = new Date(b.startAt);
        const today = new Date();
        return d.toDateString() === today.toDateString();
      });
    }
    if (view === 'week') {
      return list.filter((b) => Math.abs(new Date(b.startAt).getTime() - now) < 7 * 86400000);
    }
    return list;
  }, [blocks.data, view]);

  if (blocks.isLoading) {
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
      refreshControl={
        <RefreshControl
          refreshing={blocks.isRefetching}
          onRefresh={() => void blocks.refetch()}
        />
      }
    >
      <View style={styles.row}>
        {VIEWS.map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            style={[
              styles.chip,
              { backgroundColor: view === v ? colors.primary : colors.surfaceMuted },
            ]}
          >
            <Text
              variant="caption"
              style={{ color: view === v ? colors.primaryText : colors.text }}
            >
              {t(`providerApp.calendar.views.${v}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.calendar.schedule')}</Text>
        {filtered.map((b) => (
          <View key={b.id} style={styles.item}>
            <Text>{b.title}</Text>
            <Text muted variant="caption">
              {new Date(b.startAt).toLocaleString()} → {new Date(b.endAt).toLocaleTimeString()}
            </Text>
          </View>
        ))}
        {filtered.length === 0 ? <Text muted>{t('common.empty')}</Text> : null}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.calendar.workingHours')}</Text>
        {(availability.data ?? []).map((w) => (
          <Text key={`${w.weekday}-${w.start}`} muted>
            {t('providerApp.calendar.weekday', { day: w.weekday })}: {w.start}–{w.end}
            {w.recurring ? ` · ${t('providerApp.calendar.recurring')}` : ''}
          </Text>
        ))}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.calendar.blocked')}</Text>
        <Text muted>{t('providerApp.calendar.blockedHint')}</Text>
        <Button
          title={t('providerApp.calendar.manageAvailability')}
          variant="secondary"
          onPress={() => router.push('/(provider)/availability')}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  card: { gap: spacing.sm },
  item: { paddingVertical: spacing.xs },
});
