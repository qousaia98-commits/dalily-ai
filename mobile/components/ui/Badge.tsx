import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ label, tone = 'default' }: { label: string; tone?: Tone }) {
  const { colors } = useTheme();
  const bg =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.danger
          : tone === 'info'
            ? colors.info
            : colors.surfaceMuted;
  const fg = tone === 'default' ? colors.text : '#fff';
  return (
    <View style={[styles.base, { backgroundColor: bg }]}>
      <Text variant="caption" style={{ color: fg, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.full,
  },
});
