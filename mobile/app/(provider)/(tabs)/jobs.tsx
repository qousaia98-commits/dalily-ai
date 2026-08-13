import React, { useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Skeleton } from '@/components/ui';
import { JobCard } from '@/features/provider';
import { fetchProviderJobs, updateJobStatus } from '@/features/provider/services';
import type { JobStatus } from '@/features/provider/types';
import { useProviderUiStore } from '@/store/provider';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import * as Haptics from 'expo-haptics';

const FILTERS: (JobStatus | 'all')[] = [
  'all',
  'upcoming',
  'active',
  'completed',
  'cancelled',
  'rescheduled',
];

export default function ProviderJobsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const filter = useProviderUiStore((s) => s.jobFilter);
  const setFilter = useProviderUiStore((s) => s.setJobFilter);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['provider', 'jobs', filter],
    queryFn: () => fetchProviderJobs(filter),
  });

  const list = useMemo(() => data ?? [], [data]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.chip,
              { backgroundColor: filter === f ? colors.primary : colors.surfaceMuted },
            ]}
          >
            <Text
              variant="caption"
              style={{ color: filter === f ? colors.primaryText : colors.text }}
            >
              {t(`providerApp.jobs.filters.${f}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <Skeleton height={100} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxxl }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
          }
          ListEmptyComponent={<Text muted>{t('common.empty')}</Text>}
          renderItem={({ item }) => (
            <JobCard
              job={item}
              onPress={() => router.push(`/(provider)/jobs/${item.id}`)}
              onSwipeComplete={async () => {
                if (item.status === 'upcoming') {
                  try {
                    await Haptics.selectionAsync();
                  } catch {
                    /* optional */
                  }
                  await updateJobStatus(item.id, 'active');
                  void refetch();
                }
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, gap: spacing.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
});
