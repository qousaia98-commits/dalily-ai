import React from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Text, Button } from '@/components/ui';
import type { NativeMediaAsset } from '../types';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, radii } from '@/theme/tokens';

type Props = {
  assets: NativeMediaAsset[];
  onRemove?: (id: string) => void;
  onRetake?: (id: string) => void;
};

export function MediaPreviewList({ assets, onRemove, onRetake }: Props) {
  const { colors } = useTheme();
  if (!assets.length) {
    return <Text muted>No media selected</Text>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {assets.map((a) => (
        <View
          key={a.id}
          style={[styles.item, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Image source={{ uri: a.uri }} style={styles.img} contentFit="cover" />
          <Text muted numberOfLines={1} style={styles.caption}>
            {a.purpose}
          </Text>
          <View style={styles.actions}>
            {onRetake ? (
              <Pressable onPress={() => onRetake(a.id)}>
                <Text>Retake</Text>
              </Pressable>
            ) : null}
            {onRemove ? (
              <Button title="Delete" variant="ghost" onPress={() => onRemove(a.id)} />
            ) : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  item: {
    width: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    overflow: 'hidden',
    paddingBottom: spacing.xs,
  },
  img: { width: '100%', height: 100 },
  caption: { paddingHorizontal: spacing.xs, marginTop: spacing.xs },
  actions: { paddingHorizontal: spacing.xs, gap: 2 },
});
