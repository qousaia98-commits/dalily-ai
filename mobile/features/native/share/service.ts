import { Share, Platform } from 'react-native';
import { env } from '@/constants/env';
import type { SharePayloadKind } from '../types';
import { trackNative } from '../observability';

function appLink(path: string): string {
  const base = env.appUrl.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function shareProviderProfile(input: {
  providerId: string;
  name: string;
}): Promise<void> {
  const url = appLink(`/providers/${input.providerId}`);
  await Share.share({
    message: `Check out ${input.name} on Dalily\n${url}`,
    url: Platform.OS === 'ios' ? url : undefined,
    title: input.name,
  });
  trackNative('share_action', { kind: 'provider_profile' satisfies SharePayloadKind });
}

export async function shareBookingDetails(input: {
  bookingId: string;
  serviceTitle: string;
  when: string;
}): Promise<void> {
  const url = appLink(`/bookings/${input.bookingId}`);
  await Share.share({
    message: `My Dalily booking: ${input.serviceTitle} · ${input.when}\n${url}`,
  });
  trackNative('share_action', { kind: 'booking_details' });
}

export async function shareInvoice(input: { invoiceId: string; amountLabel: string }): Promise<void> {
  const url = appLink(`/invoices/${input.invoiceId}`);
  await Share.share({
    message: `Dalily invoice ${input.invoiceId} · ${input.amountLabel}\n${url}`,
  });
  trackNative('share_action', { kind: 'invoice' });
}

export async function sharePromotion(input: {
  title: string;
  code?: string;
  path?: string;
}): Promise<void> {
  const url = appLink(input.path ?? '/promotions');
  const codeLine = input.code ? `\nCode: ${input.code}` : '';
  await Share.share({
    message: `${input.title}${codeLine}\n${url}`,
  });
  trackNative('share_action', { kind: 'promotion' });
}

export async function shareReferralLink(input: { code: string }): Promise<void> {
  const url = appLink(`/r/${input.code}`);
  await Share.share({
    message: `Join me on Dalily — use my referral code ${input.code}\n${url}`,
  });
  trackNative('share_action', { kind: 'referral' });
}
