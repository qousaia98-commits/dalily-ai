import React, { memo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Text, Badge } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import type { ProviderJob } from '@/features/provider/types';

const TONE: Record<
  ProviderJob['status'],
  'info' | 'warning' | 'success' | 'danger' | 'default'
> = {
  upcoming: 'info',
  active: 'warning',
  completed: 'success',
  cancelled: 'danger',
  rescheduled: 'default',
};

function JobCardComponent({
  job,
  onPress,
  onSwipeComplete,
}: {
  job: ProviderJob;
  onPress: () => void;
  onSwipeComplete?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${job.serviceTitle} for ${job.customerName}`}
      onPress={onPress}
      onLongPress={onSwipeComplete}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.row}>
        <Text variant="subtitle" style={{ flex: 1 }}>
          {job.serviceTitle}
        </Text>
        <Badge label={job.status} tone={TONE[job.status]} />
      </View>
      <Text muted>{job.customerName}</Text>
      <Text muted variant="caption">
        {new Date(job.scheduledAt).toLocaleString()} · {job.address}
      </Text>
      <Text variant="caption">
        {job.price} {job.currency}
      </Text>
    </Pressable>
  );
}

export const JobCard = memo(JobCardComponent);

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
