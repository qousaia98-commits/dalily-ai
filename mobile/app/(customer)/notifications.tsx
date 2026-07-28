import React, { useEffect } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Card, Skeleton, Badge } from '@/components/ui';
import { fetchNotifications } from '@/features/customer/services';
import { useNotificationStore } from '@/store/notifications';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const setUnread = useNotificationStore((s) => s.setUnreadCount);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['customer', 'notifications'],
    queryFn: fetchNotifications,
  });

  useEffect(() => {
    if (data) setUnread(data.filter((n) => !n.read).length);
  }, [data, setUnread]);

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
      ListEmptyComponent={<Text muted>{t('common.empty')}</Text>}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => {
            qc.setQueryData(
              ['customer', 'notifications'],
              (old: typeof data) =>
                old?.map((n) => (n.id === item.id ? { ...n, read: true } : n)) ?? [],
            );
          }}
        >
          <Card style={[styles.card, !item.read && { borderColor: colors.primary }]}>
            <View style={styles.row}>
              <Badge label={item.kind} tone="info" />
              {!item.read ? <Badge label="new" tone="warning" /> : null}
            </View>
            <Text variant="subtitle">{item.title}</Text>
            <Text muted>{item.body}</Text>
          </Card>
        </Pressable>
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
