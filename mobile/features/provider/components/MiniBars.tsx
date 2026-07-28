import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

/** Lightweight mobile bar chart — no heavy chart lib. */
export function MiniBars({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const { colors } = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={styles.row} accessibilityRole="summary">
      {data.map((d) => (
        <View key={d.label} style={styles.col}>
          <View
            style={[
              styles.bar,
              {
                height: 8 + (d.value / max) * 72,
                backgroundColor: colors.primary,
              },
            ]}
          />
          <Text variant="caption" muted>
            {d.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.xs,
    minHeight: 100,
  },
  col: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  bar: { width: '70%', borderRadius: radii.sm, minHeight: 8 },
});
