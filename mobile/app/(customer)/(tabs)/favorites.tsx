import React, { useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, EmptyState, Button } from '@/components/ui';
import { ProviderCard, CategoryChip, SectionHeader } from '@/features/customer';
import { DEMO_CATEGORIES, DEMO_PROVIDERS } from '@/features/customer/demo-data';
import { useFavoritesStore } from '@/store/customer';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function CustomerFavoritesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const providerIds = useFavoritesStore((s) => s.providerIds);
  const categoryIds = useFavoritesStore((s) => s.categoryIds);

  const providers = useMemo(
    () => DEMO_PROVIDERS.filter((p) => providerIds.includes(p.id)),
    [providerIds],
  );
  const categories = useMemo(
    () => DEMO_CATEGORIES.filter((c) => categoryIds.includes(c.id)),
    [categoryIds],
  );

  useQuery({ queryKey: ['customer', 'favorites'], queryFn: async () => true });

  if (providers.length === 0 && categories.length === 0) {
    return (
      <EmptyState
        title={t('customer.favorites.empty')}
        description={t('customer.favorites.emptyHint')}
        actionLabel={t('customer.tabs.search')}
        onAction={() => router.push('/(customer)/(tabs)/search')}
      />
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={providers}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          <SectionHeader title={t('customer.favorites.categories')} />
          <View style={styles.row}>
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                category={c}
                onPress={() => router.push(`/(customer)/categories/${c.id}`)}
              />
            ))}
            {categories.length === 0 ? <Text muted>{t('common.empty')}</Text> : null}
          </View>
          <SectionHeader title={t('customer.favorites.providers')} />
        </View>
      }
      ListFooterComponent={
        providers[0] ? (
          <Button
            title={t('customer.favorites.quickRebook')}
            onPress={() => router.push(`/(customer)/book/${providers[0]!.id}`)}
            style={{ marginTop: spacing.lg }}
          />
        ) : null
      }
      renderItem={({ item }) => (
        <View style={{ marginBottom: spacing.sm }}>
          <ProviderCard
            provider={item}
            onPress={() => router.push(`/(customer)/providers/${item.id}`)}
          />
          <Pressable onPress={() => router.push(`/(customer)/book/${item.id}`)}>
            <Text variant="caption" style={{ color: colors.primary, marginTop: spacing.xs }}>
              {t('customer.favorites.rebook')}
            </Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
});
