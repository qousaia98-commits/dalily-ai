import React from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Skeleton } from '@/components/ui';
import { CategoryChip, SectionHeader } from '@/features/customer';
import { fetchCategories } from '@/features/customer/services';
import { useFavoritesStore } from '@/store/customer';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settings';

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const language = useSettingsStore((s) => s.language);
  const toggleCategory = useFavoritesStore((s) => s.toggleCategory);
  const isFav = useFavoritesStore((s) => s.isCategoryFavorite);
  const { data, isLoading } = useQuery({
    queryKey: ['customer', 'categories'],
    queryFn: fetchCategories,
  });

  const featured = (data ?? []).filter((c) => c.featured);
  const popular = (data ?? []).filter((c) => c.popular);
  const nested = (data ?? []).filter((c) => c.parentId);

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
      ListHeaderComponent={
        <View>
          <SectionHeader title={t('customer.categories.featured')} />
          <View style={styles.row}>
            {featured.map((c) => (
              <CategoryChip
                key={c.id}
                category={c}
                onPress={() => router.push(`/(customer)/categories/${c.id}`)}
              />
            ))}
          </View>
          <SectionHeader title={t('customer.categories.popular')} />
          <View style={styles.row}>
            {popular.map((c) => (
              <CategoryChip
                key={`p-${c.id}`}
                category={c}
                onPress={() => router.push(`/(customer)/categories/${c.id}`)}
              />
            ))}
          </View>
          {nested.length > 0 ? (
            <>
              <SectionHeader title={t('customer.categories.nested')} />
              <View style={styles.row}>
                {nested.map((c) => (
                  <CategoryChip
                    key={`n-${c.id}`}
                    category={c}
                    compact
                    onPress={() => router.push(`/(customer)/categories/${c.id}`)}
                  />
                ))}
              </View>
            </>
          ) : null}
          <SectionHeader title={t('customer.categories.all')} />
        </View>
      }
      renderItem={({ item }) => {
        const label = language === 'ar' ? item.name.ar : item.name.en;
        return (
          <Pressable
            onPress={() => router.push(`/(customer)/categories/${item.id}`)}
            onLongPress={() => void toggleCategory(item.id)}
            style={[styles.item, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={{ fontSize: 22 }}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text variant="subtitle">{label}</Text>
              <Text muted variant="caption">
                {item.slug}
              </Text>
            </View>
            <Pressable onPress={() => void toggleCategory(item.id)}>
              <Text>{isFav(item.id) ? '★' : '☆'}</Text>
            </Pressable>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
