export const APP_NAME = 'Dalily';
export const API_TIMEOUT_MS = 20_000;
export const API_MAX_RETRIES = 2;
export const QUERY_STALE_MS = 60_000;
export const OFFLINE_QUEUE_MAX = 100;
export const SECURE_STORE_KEYS = {
  accessToken: 'dalily.access_token',
  refreshToken: 'dalily.refresh_token',
  sessionMeta: 'dalily.session_meta',
} as const;

export const DEEP_LINK_PREFIXES = [
  'dalily://',
  'dalily-dev://',
  'dalily-staging://',
  'https://dalily.app',
  'https://www.dalily.app',
  'https://links.dalily.app',
];
