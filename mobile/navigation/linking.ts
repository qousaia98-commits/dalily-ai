import * as Linking from 'expo-linking';
import { DEEP_LINK_PREFIXES } from '@/constants/config';

export const linking = {
  prefixes: DEEP_LINK_PREFIXES,
  config: {
    screens: {
      '(auth)': {
        screens: {
          login: 'login',
          register: 'register',
          'forgot-password': 'forgot-password',
        },
      },
      '(customer)': {
        screens: {
          '(tabs)': {
            screens: {
              index: 'customer',
              search: 'customer/search',
              bookings: 'customer/bookings',
              favorites: 'customer/favorites',
              profile: 'customer/profile',
            },
          },
          'providers/[id]': 'customer/providers/:id',
          'book/[providerId]': 'customer/book/:providerId',
          'categories/index': 'customer/categories',
          notifications: 'customer/notifications',
          native: 'customer/native',
          privacy: 'customer/privacy',
        },
      },
      '(provider)': {
        screens: {
          '(tabs)': {
            screens: {
              index: 'provider',
              jobs: 'provider/jobs',
              calendar: 'provider/calendar',
              messages: 'provider/messages',
              profile: 'provider/profile',
            },
          },
          'jobs/[id]': 'provider/jobs/:id',
          assistant: 'provider/assistant',
          analytics: 'provider/analytics',
          availability: 'provider/availability',
          native: 'provider/native',
          privacy: 'provider/privacy',
        },
      },
      '(admin)': {
        screens: {
          index: 'admin',
        },
      },
    },
  },
};

export function createDeepLink(path: string): string {
  return Linking.createURL(path);
}
