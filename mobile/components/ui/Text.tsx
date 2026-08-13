import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settings';

type Variant = keyof typeof typography;

type Props = TextProps & {
  variant?: Variant;
  muted?: boolean;
};

export function Text({ variant = 'body', muted, style, ...rest }: Props) {
  const { colors, highContrast } = useTheme();
  const largeFonts = useSettingsStore((s) => s.largeFonts);
  const scale = largeFonts ? 1.15 : 1;
  const base = typography[variant];

  return (
    <RNText
      accessibilityRole="text"
      style={[
        {
          color: muted ? colors.textMuted : highContrast ? colors.highContrastText : colors.text,
          fontSize: base.fontSize * scale,
          lineHeight: base.lineHeight * scale,
          fontWeight: base.fontWeight,
        } satisfies TextStyle,
        style,
      ]}
      {...rest}
    />
  );
}
