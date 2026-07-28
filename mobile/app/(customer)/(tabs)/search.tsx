import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Input, Text, Skeleton, Badge } from '@/components/ui';
import { ProviderCard, SectionHeader } from '@/features/customer';
import {
  getSearchSuggestions,
  searchProviders,
  fetchCustomerAiInsights,
} from '@/features/customer/services';
import { useSearchStore } from '@/store/customer';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { featureFlags } from '@/constants/env';
import { useSettingsStore } from '@/store/settings';

export default function CustomerSearchScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const language = useSettingsStore((s) => s.language);
  const [query, setQuery] = useState('');
  const history = useSearchStore((s) => s.history);
  const addQuery = useSearchStore((s) => s.addQuery);
  const clearHistory = useSearchStore((s) => s.clearHistory);

  const suggestions = useMemo(() => getSearchSuggestions(query), [query]);

  const { data, isFetching, refetch, isRefetching } = useQuery({
    queryKey: ['customer', 'search', query],
    queryFn: () => searchProviders({ query }),
  });

  const ai = useQuery({
    queryKey: ['customer', 'ai-search'],
    queryFn: () => fetchCustomerAiInsights(),
    enabled: featureFlags.customerAi,
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Input
        label={t('customer.search.label')}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => void addQuery(query)}
        placeholder={t('customer.home.searchPlaceholder')}
        autoCorrect={false}
        returnKeyType="search"
      />
      {featureFlags.voiceSearchPrep ? (
        <Text muted variant="caption">
          {t('customer.search.voicePrep')}
        </Text>
      ) : null}

      {history.length > 0 ? (
        <>
          <SectionHeader
            title={t('customer.search.history')}
            action={
              <Pressable onPress={() => void clearHistory()}>
                <Text variant="caption">{t('customer.search.clear')}</Text>
              </Pressable>
            }
          />
          <View style={styles.chips}>
            {history.map((h) => (
              <Pressable
                key={h}
                onPress={() => setQuery(h)}
                style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}
              >
                <Text variant="caption">{h}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title={t('customer.search.suggestions')} />
      <View style={styles.chips}>
        {suggestions.map((s) => (
          <Pressable
            key={s}
            onPress={() => {
              setQuery(s);
              void addQuery(s);
            }}
            style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}
          >
            <Text variant="caption">{s}</Text>
          </Pressable>
        ))}
      </View>

      {featureFlags.customerAi && ai.data?.length ? (
        <>
          <SectionHeader title={t('customer.search.aiSuggestions')} />
          {ai.data.slice(0, 2).map((insight) => (
            <View key={insight.code} style={{ marginBottom: spacing.sm }}>
              <Badge label="AI" tone="info" />
              <Text muted>
                {language === 'ar' ? insight.labelAr : insight.labelEn}
              </Text>
            </View>
          ))}
        </>
      ) : null}

      <SectionHeader title={t('customer.search.results')} />
      {isFetching && !data ? (
        <Skeleton height={80} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxxl }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
          }
          ListEmptyComponent={<Text muted>{t('common.empty')}</Text>}
          renderItem={({ item }) => (
            <ProviderCard
              provider={item}
              onPress={() => {
                void addQuery(query);
                router.push(`/(customer)/providers/${item.id}`);
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
});
