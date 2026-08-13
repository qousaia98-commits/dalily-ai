import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { name?: string | null; uri?: string | null; size?: number };

export function Avatar({ name, size = 40 }: Props) {
  const { colors } = useTheme();
  const initial = (name?.trim()?.[0] ?? 'D').toUpperCase();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name ?? 'Avatar'}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary,
        },
      ]}
    >
      <Text style={{ color: colors.primaryText, fontWeight: '700' }}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
