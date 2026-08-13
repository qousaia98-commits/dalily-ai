import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Text, Badge } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import type { CustomerBooking } from '@/features/customer/types';

const STATUS_TONE: Record<
  CustomerBooking['status'],
  'info' | 'warning' | 'success' | 'danger'
> = {
  upcoming: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

export function BookingListItem({
  booking,
  onPress,
}: {
  booking: CustomerBooking;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.row}>
        <Text variant="subtitle" style={{ flex: 1 }}>
          {booking.serviceTitle}
        </Text>
        <Badge label={booking.status.replace('_', ' ')} tone={STATUS_TONE[booking.status]} />
      </View>
      <Text muted>{booking.providerName}</Text>
      <Text muted variant="caption">
        {new Date(booking.scheduledAt).toLocaleString()} · {booking.address}
      </Text>
      {booking.priceEstimate > 0 ? (
        <Text variant="caption">
          ~{booking.priceEstimate} {booking.currency}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
