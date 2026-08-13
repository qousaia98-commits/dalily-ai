import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Card, Button, Badge, Skeleton, EmptyState } from '@/components/ui';
import { fetchProviderProfile } from '@/features/customer/services';
import { shareProviderProfile } from '@/features/native';
import { useSearchStore, useFavoritesStore } from '@/store/customer';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settings';
import { featureFlags } from '@/constants/env';

export default function ProviderProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const language = useSettingsStore((s) => s.language);
  const markViewed = useSearchStore((s) => s.markProviderViewed);
  const toggle = useFavoritesStore((s) => s.toggleProvider);
  const isFav = useFavoritesStore((s) => s.isProviderFavorite(id ?? ''));

  const { data, isLoading } = useQuery({
    queryKey: ['customer', 'provider', id],
    queryFn: () => fetchProviderProfile(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (id) void markViewed(id);
  }, [id, markViewed]);

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Skeleton height={200} />
      </View>
    );
  }

  if (!data) return <EmptyState title={t('common.empty')} />;

  const about = language === 'ar' ? data.about.ar : data.about.en;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text variant="title" style={{ flex: 1 }}>
            {data.name}
          </Text>
          {data.verified ? <Badge label="Verified" tone="success" /> : null}
        </View>
        <Text muted>
          ★ {data.rating.toFixed(1)} · {data.reviewCount} · Trust{' '}
          {Math.round(data.trustScore * 100)}%
        </Text>
        <Text muted>
          {data.city}
          {data.distanceKm != null ? ` · ${data.distanceKm.toFixed(1)} km` : ''}
        </Text>
        {data.aiMatchScore != null && featureFlags.customerAi ? (
          <Badge label={`AI match ${Math.round(data.aiMatchScore * 100)}%`} tone="info" />
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.provider.about')}</Text>
        <Text>{about}</Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.provider.gallery')}</Text>
        <Text muted>
          {data.gallery.length ? `${data.gallery.length} photos` : t('customer.provider.noGallery')}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.provider.services')}</Text>
        {data.services.map((s) => (
          <View key={s.id} style={styles.service}>
            <Text>{language === 'ar' ? s.title.ar : s.title.en}</Text>
            <Text muted>
              from {s.priceFrom} {data.currency} · {s.durationMin}m
            </Text>
          </View>
        ))}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.provider.availability')}</Text>
        <Text muted>
          {data.available ? t('customer.provider.availableNow') : t('customer.provider.busy')}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.provider.reviews')}</Text>
        {data.reviews.map((r) => (
          <View key={r.id} style={{ marginTop: spacing.sm }}>
            <Text>
              ★ {r.rating} — {r.author}
            </Text>
            <Text muted>{r.comment}</Text>
          </View>
        ))}
      </Card>

      {data.highlights.length > 0 && featureFlags.customerAi ? (
        <Card style={styles.card}>
          <Text variant="subtitle">{t('customer.provider.highlights')}</Text>
          {data.highlights.map((h) => (
            <Text key={h} muted>
              • {h}
            </Text>
          ))}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.provider.map')}</Text>
        <Text muted>
          {data.lat != null && data.lng != null
            ? `${data.lat.toFixed(3)}, ${data.lng.toFixed(3)}`
            : t('customer.provider.mapUnavailable')}
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button
          title={isFav ? t('customer.favorites.saved') : t('customer.favorites.save')}
          variant="secondary"
          onPress={() => void toggle(data.id)}
        />
        <Button
          title={t('customer.provider.share')}
          variant="ghost"
          onPress={() =>
            void shareProviderProfile({ providerId: data.id, name: data.name })
          }
        />
        <Button
          title={t('customer.provider.book')}
          onPress={() => router.push(`/(customer)/book/${data.id}`)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  service: { paddingVertical: spacing.xs },
  actions: { gap: spacing.sm },
});
