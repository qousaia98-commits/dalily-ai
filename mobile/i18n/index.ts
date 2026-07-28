import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from '@/i18n/locales/en.json';
import ar from '@/i18n/locales/ar.json';
import { useSettingsStore, type AppLanguage } from '@/store/settings';

const deviceLang = Localization.getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';

// Default export instance methods (i18next package API).
void i18next.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: deviceLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function applyLanguage(language: AppLanguage): void {
  void i18next.changeLanguage(language);
  useSettingsStore.getState().setLanguage(language);
}

export { i18next as i18n };
