/**
 * Expo app config — environment-aware production configuration.
 * Prefer this over static app.json (kept as fallback reference only).
 */

import type { ExpoConfig, ConfigContext } from 'expo/config';

type AppEnv = 'development' | 'staging' | 'production';

function resolveAppEnv(): AppEnv {
  const raw = (process.env.APP_ENV ?? process.env.EXPO_PUBLIC_APP_ENV ?? 'development').toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'staging' || raw === 'preview') return 'staging';
  return 'development';
}

const APP_ENV = resolveAppEnv();

const ENV_META = {
  development: {
    name: 'Dalily Dev',
    slug: 'dalily',
    scheme: 'dalily-dev',
    bundleIdentifier: 'app.dalily.mobile.dev',
    package: 'app.dalily.mobile.dev',
    icon: './assets/icon.png',
    updatesUrl: undefined as string | undefined,
  },
  staging: {
    name: 'Dalily Staging',
    slug: 'dalily',
    scheme: 'dalily-staging',
    bundleIdentifier: 'app.dalily.mobile.staging',
    package: 'app.dalily.mobile.staging',
    icon: './assets/icon.png',
    updatesUrl: 'https://u.expo.dev/dalily-mobile-foundation',
  },
  production: {
    name: 'Dalily',
    slug: 'dalily',
    scheme: 'dalily',
    bundleIdentifier: 'app.dalily.mobile',
    package: 'app.dalily.mobile',
    icon: './assets/icon.png',
    updatesUrl: 'https://u.expo.dev/dalily-mobile-foundation',
  },
} as const;

const meta = ENV_META[APP_ENV];

const PRIVACY_URL = 'https://dalily.app/privacy';
const TERMS_URL = 'https://dalily.app/terms';
const MARKETING_URL = 'https://dalily.app';
const SUPPORT_URL = 'https://dalily.app/support';
const SUPPORT_EMAIL = 'support@dalily.app';

export default ({ config }: ConfigContext): ExpoConfig =>
  ({
  ...config,
  name: meta.name,
  slug: meta.slug,
  version: '1.0.0',
  orientation: 'portrait',
  icon: meta.icon,
  scheme: meta.scheme,
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates:
    APP_ENV === 'development'
      ? {
          enabled: false,
        }
      : {
          url: meta.updatesUrl!,
          enabled: true,
          checkAutomatically: 'ON_LOAD' as const,
          fallbackToCacheTimeout: 0,
          requestHeaders: {
            'expo-channel-name': APP_ENV === 'production' ? 'production' : 'preview',
          },
        },
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0B1F17',
    dark: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#06140F',
    },
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: meta.bundleIdentifier,
    buildNumber: '1',
    associatedDomains: [
      'applinks:dalily.app',
      'applinks:www.dalily.app',
      'applinks:links.dalily.app',
    ],
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      CFBundleDisplayName: meta.name,
      NSCameraUsageDescription:
        'Dalily uses the camera so you can take profile photos, document completed jobs, and upload verification documents.',
      NSPhotoLibraryUsageDescription:
        'Dalily accesses your photo library so you can attach images to bookings, your business gallery, and support requests.',
      NSPhotoLibraryAddUsageDescription:
        'Dalily may save invoices and job photos to your library when you choose to download them.',
      NSLocationWhenInUseUsageDescription:
        'Dalily uses your location to show nearby providers, detect your service address, and help navigate to jobs.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Dalily may use background location only during an active job when you explicitly opt in for live arrival updates.',
      NSFaceIDUsageDescription:
        'Dalily uses Face ID to unlock the app and confirm sensitive actions such as account changes.',
      UIBackgroundModes: ['remote-notification', 'fetch'],
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePreciseLocation',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotos',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
      ],
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#0B1F17',
    },
    package: meta.package,
    versionCode: 1,
    permissions: [
      'CAMERA',
      'READ_MEDIA_IMAGES',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'POST_NOTIFICATIONS',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
      'INTERNET',
      'VIBRATE',
      'RECEIVE_BOOT_COMPLETED',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'dalily.app', pathPrefix: '/' },
          { scheme: 'https', host: 'www.dalily.app', pathPrefix: '/' },
          { scheme: 'https', host: 'links.dalily.app', pathPrefix: '/' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        data: [{ scheme: meta.scheme }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0B1F17',
        image: './assets/splash-icon.png',
        dark: {
          backgroundColor: '#06140F',
          image: './assets/splash-icon.png',
        },
        imageWidth: 200,
      },
    ],
    'expo-local-authentication',
    [
      'expo-notifications',
      {
        icon: './assets/android-icon-monochrome.png',
        color: '#0B1F17',
        defaultChannel: 'dalily-default',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Allow Dalily to use your camera for profile photos, job documentation, and verification.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow Dalily to access your photos so you can attach images to bookings and your business gallery.',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow Dalily to use your location during an active job when you opt in for live updates.',
        locationWhenInUsePermission:
          'Allow Dalily to use your location to find nearby services and guide navigation.',
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
    'expo-updates',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '31ba2a6f-f542-4e2a-a533-0314c55555fc',
    },
    router: {
      origin: false,
    },
    appEnv: APP_ENV,
    privacyUrl: PRIVACY_URL,
    termsUrl: TERMS_URL,
    marketingUrl: MARKETING_URL,
    supportUrl: SUPPORT_URL,
    supportEmail: SUPPORT_EMAIL,
  },
  owner: process.env.EAS_OWNER ?? 'quabbasis-team',
  }) as ExpoConfig;
