import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Card, Skeleton, Badge, Button } from '@/components/ui';
import { ProviderCard, CategoryChip, SectionHeader } from '@/features/customer';
import { fetchHomeFeed } from '@/features/customer/services';
import { detectCustomerAddress } from '@/features/native/location/service';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { featureFlags } from '@/constants/env';
import { useSettingsStore } from '@/store/settings';

export default function CustomerHomeScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { colors } = useTheme();
  const language = useSettingsStore((s) => s.language);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['customer', 'home'],
    queryFn: fetchHomeFeed,
  });
  // Real device location — falls back to the feed's placeholder label
  // (only accurate once we have actual permission/GPS) rather than blocking render.
  const { data: deviceAddress } = useQuery({
    queryKey: ['customer', 'device-location'],
    queryFn: async () => {
      try {
        const { address } = await detectCustomerAddress();
        return address ?? null;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const openProvider = useCallback((id: string) => {
    router.push(`/(customer)/providers/${id}`);
  }, []);

  if (isLoading || !data) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Skeleton height={28} width="60%" />
        <Skeleton height={48} />
        <Skeleton height={100} />
        <Skeleton height={100} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
      }
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text muted variant="caption">
            {t('customer.home.welcome')}
            {user?.email ? `, ${user.email.split('@')[0]}` : ''}
          </Text>
          <Text variant="title">{t('customer.title')}</Text>
          <Text muted>📍 {deviceAddress ?? data.locationLabel}</Text>
        </View>
        <Pressable onPress={() => router.push('/(customer)/notifications')}>
          <Badge label="🔔" tone="info" />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="search"
        onPress={() => router.push('/(customer)/(tabs)/search')}
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text muted>{t('customer.home.searchPlaceholder')}</Text>
      </Pressable>

      {featureFlags.webRequestFlow ? (
        <Button
          title={t('customer.home.postRequest')}
          onPress={() =>
            router.push({
              pathname: '/(customer)/web-request',
              params: { target: '/request/new' },
            })
          }
        />
      ) : null}

      <SectionHeader
        title={t('customer.home.quickActions')}
      />
      <View style={styles.quickRow}>
        {featureFlags.webRequestFlow ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(customer)/web-request',
                params: { target: '/request/new' },
              })
            }
            style={[styles.quick, { backgroundColor: colors.surfaceMuted }]}
          >
            <Text variant="caption">{t('customer.home.postRequest')}</Text>
          </Pressable>
        ) : null}
        {data.quickActions.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => router.push(a.href as `/(customer)/${string}`)}
            style={[styles.quick, { backgroundColor: colors.surfaceMuted }]}
          >
            <Text variant="caption">{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {data.banners.map((b) => (
        <Card key={b.id} style={styles.banner}>
          <Text variant="subtitle">{b.title}</Text>
          <Text muted>{b.subtitle}</Text>
        </Card>
      ))}

      <SectionHeader
        title={t('customer.home.popularCategories')}
        action={
          <Pressable onPress={() => router.push('/(customer)/categories')}>
            <Text variant="caption" style={{ color: colors.primary }}>
              {t('common.continue')}
            </Text>
          </Pressable>
        }
      />
      <FlatList
        horizontal
        data={data.categories}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <CategoryChip
            category={item}
            onPress={() => router.push(`/(customer)/categories/${item.id}`)}
          />
        )}
      />

      {featureFlags.customerAi && data.aiRecommendations.length > 0 ? (
        <>
          <SectionHeader title={t('customer.home.aiRecommendations')} />
          {data.aiRecommendations.map((insight) => (
            <Card key={insight.code} style={{ marginBottom: spacing.sm }}>
              <Badge label={insight.kind} tone="info" />
              <Text style={{ marginTop: spacing.xs }}>
                {language === 'ar' ? insight.labelAr : insight.labelEn}
              </Text>
            </Card>
          ))}
        </>
      ) : null}

      <SectionHeader title={t('customer.home.recommended')} />
      <View style={{ gap: spacing.sm }}>
        {data.recommended.map((p) => (
          <ProviderCard key={p.id} provider={p} onPress={() => openProvider(p.id)} />
        ))}
      </View>

      <SectionHeader title={t('customer.home.recentlyViewed')} />
      <View style={{ gap: spacing.sm }}>
        {data.recentlyViewed.map((p) => (
          <ProviderCard key={p.id} provider={p} onPress={() => openProvider(p.id)} />
        ))}
      </View>

      <SectionHeader title={t('customer.home.trending')} />
      <View style={{ gap: spacing.sm }}>
        {data.trending.slice(0, 4).map((p) => (
          <ProviderCard key={p.id} provider={p} onPress={() => openProvider(p.id)} />
        ))}
      </View>

      <SectionHeader title={t('customer.home.nearby')} />
      <View style={{ gap: spacing.sm }}>
        {data.nearby.slice(0, 4).map((p) => (
          <ProviderCard key={p.id} provider={p} onPress={() => openProvider(p.id)} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, gap: spacing.md },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quick: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  banner: { gap: spacing.xs, marginTop: spacing.sm },
});
