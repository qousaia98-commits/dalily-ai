/**
 * Issues a one-time bridge code and builds the WebView URL for the web marketplace flow.
 * Tokens travel over HTTPS (header/body) — never in the WebView URL.
 */

import { env } from '@/constants/env';
import { loadSession } from '@/lib/secure-storage';

export type BridgeUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: 'no_session' | 'issue_failed' | 'network' };

const DEFAULT_TARGET = '/request/new';

export async function buildMobileBridgeWebViewUrl(
  target: string = DEFAULT_TARGET,
): Promise<BridgeUrlResult> {
  const session = await loadSession();
  if (!session?.accessToken || !session.refreshToken) {
    return { ok: false, error: 'no_session' };
  }

  const appUrl = env.appUrl.replace(/\/$/, '');
  let response: Response;
  try {
    response = await fetch(`${appUrl}/api/auth/mobile-bridge/issue`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
  } catch {
    return { ok: false, error: 'network' };
  }

  if (!response.ok) {
    return { ok: false, error: 'issue_failed' };
  }

  let payload: { code?: unknown };
  try {
    payload = (await response.json()) as { code?: unknown };
  } catch {
    return { ok: false, error: 'issue_failed' };
  }

  const code = typeof payload.code === 'string' ? payload.code.trim() : '';
  if (!code) {
    return { ok: false, error: 'issue_failed' };
  }

  const url = `${appUrl}/auth/mobile-bridge?code=${encodeURIComponent(code)}&target=${encodeURIComponent(target)}`;
  return { ok: true, url };
}

/** True when the URL should leave the in-app WebView (payments, mailto, other origins). */
export function shouldOpenExternally(requestUrl: string, appOrigin: string): boolean {
  const origin = appOrigin.replace(/\/$/, '');
  try {
    const parsed = new URL(requestUrl);
    if (parsed.protocol === 'mailto:' || parsed.protocol === 'tel:' || parsed.protocol === 'sms:') {
      return true;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return true;
    }
    const app = new URL(origin);
    if (parsed.origin !== app.origin) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}
