import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useOfflineStore } from '@/store/offline';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const queueSize = useOfflineStore((s) => s.queueSize);
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (isOnline && queueSize === 0) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: isOnline ? colors.info : colors.warning }]}
    >
      <Text style={{ color: '#fff' }}>
        {isOnline ? `Syncing ${queueSize} queued requests…` : t('common.offline')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
