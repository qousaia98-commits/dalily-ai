import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing, touchTarget } from '@/theme/tokens';
import type { CustomerCategory } from '@/features/customer/types';
import { useSettingsStore } from '@/store/settings';

type Props = {
  category: CustomerCategory;
  onPress: () => void;
  compact?: boolean;
};

function CategoryChipComponent({ category, onPress, compact }: Props) {
  const { colors } = useTheme();
  const language = useSettingsStore((s) => s.language);
  const label = language === 'ar' ? category.name.ar : category.name.en;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        compact && styles.compact,
        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
      ]}
    >
      <Text style={{ fontSize: compact ? 18 : 22 }}>{category.icon}</Text>
      <Text variant={compact ? 'caption' : 'label'} numberOfLines={1}>
        {label}
      </Text>
      {category.featured ? (
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      ) : null}
    </Pressable>
  );
}

export const CategoryChip = memo(CategoryChipComponent);

const styles = StyleSheet.create({
  chip: {
    minHeight: touchTarget.min,
    minWidth: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  compact: { minWidth: 72, paddingHorizontal: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
