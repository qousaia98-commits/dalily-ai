import React from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Card, Badge, Skeleton } from '@/components/ui';
import { fetchMessages } from '@/features/provider/services';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function ProviderMessagesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['provider', 'messages'],
    queryFn: fetchMessages,
  });

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Skeleton height={80} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={data ?? []}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
      }
      ListEmptyComponent={<Text muted>{t('common.empty')}</Text>}
      renderItem={({ item }) => (
        <Card style={[styles.card, item.unread && { borderColor: colors.primary }]}>
          <View style={styles.row}>
            <Badge label={item.kind} tone="info" />
            {item.unread ? <Badge label={t('providerApp.messages.unread')} tone="warning" /> : null}
          </View>
          <Text variant="subtitle">{item.title}</Text>
          <Text muted>{item.body}</Text>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl },
  card: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
});
