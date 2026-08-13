import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Card, Skeleton, EmptyState } from '@/components/ui';
import { ProviderCard } from '@/features/customer';
import { fetchCategories, searchProviders } from '@/features/customer/services';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settings';

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const language = useSettingsStore((s) => s.language);

  const cats = useQuery({ queryKey: ['customer', 'categories'], queryFn: fetchCategories });
  const category = (cats.data ?? []).find((c) => c.id === id);
  const providers = useQuery({
    queryKey: ['customer', 'category-providers', id],
    queryFn: () => searchProviders({ categoryId: id }),
    enabled: Boolean(id),
  });

  if (cats.isLoading || providers.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Skeleton height={120} />
      </View>
    );
  }

  if (!category) {
    return <EmptyState title={t('common.empty')} />;
  }

  const label = language === 'ar' ? category.name.ar : category.name.en;

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={providers.data ?? []}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <Card style={{ gap: spacing.sm, marginBottom: spacing.md }}>
          <Text style={{ fontSize: 36 }}>{category.icon}</Text>
          <Text variant="title">{label}</Text>
          <Text muted>{t('customer.categories.detailHint')}</Text>
        </Card>
      }
      ListEmptyComponent={<Text muted>{t('common.empty')}</Text>}
      renderItem={({ item }) => (
        <View style={{ marginBottom: spacing.sm }}>
          <ProviderCard
            provider={item}
            onPress={() => router.push(`/(customer)/providers/${item.id}`)}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
});
