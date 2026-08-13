import { create } from 'zustand';
import type { ColorScheme } from '@/theme/tokens';

export type AppLanguage = 'en' | 'ar';
export type ThemePreference = ColorScheme | 'system';

type SettingsState = {
  language: AppLanguage;
  themePreference: ThemePreference;
  highContrast: boolean;
  largeFonts: boolean;
  setLanguage: (language: AppLanguage) => void;
  setThemePreference: (themePreference: ThemePreference) => void;
  setHighContrast: (highContrast: boolean) => void;
  setLargeFonts: (largeFonts: boolean) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'en',
  themePreference: 'system',
  highContrast: false,
  largeFonts: false,
  setLanguage: (language) => set({ language }),
  setThemePreference: (themePreference) => set({ themePreference }),
  setHighContrast: (highContrast) => set({ highContrast }),
  setLargeFonts: (largeFonts) => set({ largeFonts }),
}));
