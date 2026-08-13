import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Skeleton } from '@/components/ui';
import { BookingListItem } from '@/features/customer';
import { fetchBookings } from '@/features/customer/services';
import type { BookingStatus } from '@/features/customer/types';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const FILTERS: (BookingStatus | 'all')[] = [
  'all',
  'upcoming',
  'in_progress',
  'completed',
  'cancelled',
];

export default function CustomerBookingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['customer', 'bookings'],
    queryFn: fetchBookings,
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (filter === 'all') return list;
    return list.filter((b) => b.status === filter);
  }, [data, filter]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.chip,
              {
                backgroundColor: filter === f ? colors.primary : colors.surfaceMuted,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{ color: filter === f ? colors.primaryText : colors.text }}
            >
              {t(`customer.bookings.filters.${f}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <Skeleton height={100} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxxl }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
          }
          ListEmptyComponent={<Text muted>{t('common.empty')}</Text>}
          renderItem={({ item }) => (
            <BookingListItem
              booking={item}
              onPress={() => router.push(`/(customer)/bookings/${item.id}`)}
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
