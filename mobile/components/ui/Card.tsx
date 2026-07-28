import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

type Props = ViewProps & { padded?: boolean };

export function Card({ padded = true, style, children, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
