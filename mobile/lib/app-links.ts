/**
 * App Links / Universal Links / deep link helpers.
 */

import * as Linking from 'expo-linking';
import { DEEP_LINK_PREFIXES } from '@/constants/config';
import { env } from '@/constants/env';

export const APP_LINK_HOSTS = ['dalily.app', 'www.dalily.app', 'links.dalily.app'] as const;

export type AppLinkKind =
  | 'provider_profile'
  | 'booking'
  | 'referral'
  | 'invitation'
  | 'qr_launch'
  | 'custom';

export function createAppLink(kind: AppLinkKind, idOrCode: string): string {
  const base = env.appUrl.replace(/\/$/, '');
  switch (kind) {
    case 'provider_profile':
      return `${base}/providers/${idOrCode}`;
    case 'booking':
      return `${base}/bookings/${idOrCode}`;
    case 'referral':
      return `${base}/r/${idOrCode}`;
    case 'invitation':
      return `${base}/invite/${idOrCode}`;
    case 'qr_launch':
      return `${base}/q/${idOrCode}`;
    default:
      return `${base}/${idOrCode}`;
  }
}

export function createSchemeLink(path: string): string {
  return Linking.createURL(path);
}

export function parseIncomingUrl(url: string): {
  path: string;
  queryParams: Record<string, string | undefined>;
} {
  const parsed = Linking.parse(url);
  return {
    path: parsed.path ?? '',
    queryParams: (parsed.queryParams ?? {}) as Record<string, string | undefined>,
  };
}

export const appLinksConfig = {
  prefixes: DEEP_LINK_PREFIXES,
  hosts: APP_LINK_HOSTS,
  iosAssociatedDomains: APP_LINK_HOSTS.map((h) => `applinks:${h}`),
  androidAssetLinksNote:
    'Host /.well-known/assetlinks.json with the Play App Signing SHA-256 fingerprint.',
  appleAppSiteAssociationNote:
    'Host /.well-known/apple-app-site-association with appID TEAMID.app.dalily.mobile.',
} as const;
