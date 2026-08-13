import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme as useSystemScheme } from 'react-native';
import { createColors, type ColorScheme, type ThemeColors } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settings';

type ThemeContextValue = {
  scheme: ColorScheme;
  colors: ThemeColors;
  isRTL: boolean;
  highContrast: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useSystemScheme();
  const preference = useSettingsStore((s) => s.themePreference);
  const language = useSettingsStore((s) => s.language);
  const highContrast = useSettingsStore((s) => s.highContrast);

  const scheme: ColorScheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: createColors(scheme),
      isRTL: language === 'ar',
      highContrast,
    }),
    [scheme, language, highContrast],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
