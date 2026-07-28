/**
 * Dalily Design System — semantic tokens.
 * Brand: deep green + gold (aligned with web).
 */

export type ColorScheme = 'light' | 'dark';

export const palette = {
  forest: '#0B1F17',
  forestMid: '#143D2B',
  gold: '#C6A15B',
  goldSoft: '#E8D5A3',
  cream: '#F7F3EA',
  sand: '#EFE7D6',
  ink: '#0F1713',
  mist: '#8A938C',
  danger: '#C45C4A',
  success: '#2F7D4B',
  warning: '#C48A2A',
  info: '#3A6EA5',
} as const;

export function createColors(scheme: ColorScheme) {
  const dark = scheme === 'dark';
  return {
    background: dark ? palette.forest : palette.cream,
    surface: dark ? palette.forestMid : '#FFFFFF',
    surfaceMuted: dark ? '#1A2E24' : palette.sand,
    text: dark ? palette.cream : palette.ink,
    textMuted: dark ? palette.mist : '#5C665F',
    border: dark ? '#2A4034' : '#D9D0BE',
    primary: palette.gold,
    primaryText: palette.forest,
    danger: palette.danger,
    success: palette.success,
    warning: palette.warning,
    info: palette.info,
    overlay: 'rgba(11, 31, 23, 0.55)',
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
