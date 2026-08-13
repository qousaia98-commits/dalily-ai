import React, { memo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Text, Badge, Avatar } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import type { CustomerProvider } from '@/features/customer/types';
import { useFavoritesStore } from '@/store/customer';
import { featureFlags } from '@/constants/env';

type Props = {
  provider: CustomerProvider;
  onPress: () => void;
  showMatchScore?: boolean;
};

function ProviderCardComponent({ provider, onPress, showMatchScore = true }: Props) {
  const { colors } = useTheme();
  const toggle = useFavoritesStore((s) => s.toggleProvider);
  const isFav = useFavoritesStore((s) => s.isProviderFavorite(provider.id));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${provider.name}, rating ${provider.rating}`}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.row}>
        {provider.photoUrl ? (
          <Image
            source={{ uri: provider.photoUrl }}
            style={styles.photo}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Avatar name={provider.name} size={56} />
        )}
        <View style={styles.meta}>
          <View style={styles.titleRow}>
            <Text variant="subtitle" numberOfLines={1} style={{ flex: 1 }}>
              {provider.name}
            </Text>
            {provider.verified ? <Badge label="Verified" tone="success" /> : null}
          </View>
          <Text muted variant="caption">
            ★ {provider.rating.toFixed(1)} · {provider.reviewCount} reviews
            {provider.distanceKm != null ? ` · ${provider.distanceKm.toFixed(1)} km` : ''}
          </Text>
          <Text muted variant="caption">
            From {provider.startingPrice} {provider.currency}
            {provider.available ? ' · Available' : ' · Busy'}
            {provider.responseTimeMin != null ? ` · ~${provider.responseTimeMin}m` : ''}
          </Text>
          {showMatchScore && provider.aiMatchScore != null && featureFlags.customerApp ? (
            <Text variant="caption" style={{ color: colors.info }}>
              AI match {Math.round(provider.aiMatchScore * 100)}%
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Remove favorite' : 'Save favorite'}
          hitSlop={8}
          onPress={async () => {
            try {
              await Haptics.selectionAsync();
            } catch {
              /* optional */
            }
            await toggle(provider.id);
          }}
        >
          <Text style={{ fontSize: 22 }}>{isFav ? '♥' : '♡'}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export const ProviderCard = memo(ProviderCardComponent);

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  photo: { width: 56, height: 56, borderRadius: radii.md },
  meta: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
