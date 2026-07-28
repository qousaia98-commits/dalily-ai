import React from 'react';
import {
  Pressable,
  Text as RNText,
  StyleSheet,
  type PressableProps,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing, touchTarget, typography } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: Variant;
};

export function Button({
  title,
  loading,
  variant = 'primary',
  disabled,
  style,
  ...rest
}: Props) {
  const { colors, highContrast } = useTheme();
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.surfaceMuted
          : 'transparent';
  const fg =
    variant === 'primary'
      ? colors.primaryText
      : variant === 'danger'
        ? '#fff'
        : highContrast
          ? colors.highContrastText
          : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1,
          borderColor: variant === 'ghost' ? colors.border : 'transparent',
          borderWidth: variant === 'ghost' ? 1 : 0,
        },
        style as object,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <RNText style={[styles.label, { color: fg }]}>{title}</RNText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.label,
    fontSize: 15,
  },
});
