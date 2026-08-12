/**
 * Dalily Design System — semantic tokens.
 * Brand: navy + gold — kept byte-for-byte aligned with the web app's
 * CSS custom properties in src/app/globals.css (--dalily-navy, --dalily-gold, …).
 */

export type ColorScheme = 'light' | 'dark';

export const palette = {
  navy: '#0B1526',
  navyDeep: '#151F33',
  gold: '#C4A052',
  goldLight: '#D4B76A',
  white: '#FFFFFF',
  surface: '#F7F8FA',
  border: '#E4E7ED',
  borderDark: '#2A3347',
  muted: '#8A93A8',
  textSecondary: '#5C6478',
  danger: '#C45C4A',
  success: '#2F7D4B',
  warning: '#C48A2A',
  info: '#3A6EA5',
} as const;

export function createColors(scheme: ColorScheme) {
  const dark = scheme === 'dark';
  return {
    background: dark ? palette.navy : palette.white,
    surface: dark ? palette.navyDeep : palette.white,
    surfaceMuted: dark ? palette.navyDeep : palette.surface,
    text: dark ? palette.white : palette.navy,
    textMuted: dark ? palette.muted : palette.textSecondary,
    border: dark ? palette.borderDark : palette.border,
    primary: palette.gold,
    primaryText: palette.navy,
    danger: palette.danger,
    success: palette.success,
    warning: palette.warning,
    info: palette.info,
    overlay: 'rgba(11, 21, 38, 0.55)',
    highContrastText: dark ? '#FFFFFF' : '#000000',
  } as const;
}

export type ThemeColors = ReturnType<typeof createColors>;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const },
  subtitle: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
};

export const touchTarget = {
  min: 44,
};
