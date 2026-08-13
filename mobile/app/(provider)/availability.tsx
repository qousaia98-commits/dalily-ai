import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Card, Skeleton } from '@/components/ui';
import { fetchAvailability } from '@/features/provider/services';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function ProviderAvailabilityScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data, isLoading } = useQuery({
    queryKey: ['provider', 'availability'],
    queryFn: fetchAvailability,
  });

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Skeleton height={160} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.calendar.workingHours')}</Text>
        {(data ?? []).map((w) => (
          <Text key={`${w.weekday}-${w.start}`} muted>
            {t('providerApp.calendar.weekday', { day: w.weekday })}: {w.start}–{w.end}
            {w.recurring ? ` · ${t('providerApp.calendar.recurring')}` : ''}
          </Text>
        ))}
      </Card>
      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.calendar.vacation')}</Text>
        <Text muted>{t('providerApp.calendar.vacationHint')}</Text>
      </Card>
      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.calendar.blocked')}</Text>
        <Text muted>{t('providerApp.calendar.blockedHint')}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.sm },
});
