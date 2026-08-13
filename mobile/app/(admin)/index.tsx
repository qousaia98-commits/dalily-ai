import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Text, Badge } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function AdminHome() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Card style={{ gap: spacing.md }}>
        <Badge label="Admin" tone="warning" />
        <Text variant="title">{t('admin.title')}</Text>
        <Text muted>{t('admin.subtitle')}</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
});
