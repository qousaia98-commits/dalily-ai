import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { useTranslation } from 'react-i18next';

export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.center} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primary} size="large" />
      <Text muted>{label ?? t('common.loading')}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Text variant="subtitle">{title ?? t('common.empty')}</Text>
      {description ? (
        <Text muted style={{ textAlign: 'center' }}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Text variant="subtitle" style={{ color: colors.danger }}>
        {message ?? t('common.error')}
      </Text>
      {onRetry ? <Button title={t('common.retry')} onPress={onRetry} /> : null}
    </View>
  );
}

export function Skeleton({ height = 16, width = '100%' as const }: { height?: number; width?: number | `${number}%` }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height,
        width,
        borderRadius: 8,
        backgroundColor: colors.surfaceMuted,
        marginVertical: spacing.xs,
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
});
