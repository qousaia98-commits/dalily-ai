/**
 * Reusable API client — auth, refresh, retries, timeout, queue, logging.
 */

import { API_MAX_RETRIES, API_TIMEOUT_MS } from '@/constants/config';
import { env, featureFlags } from '@/constants/env';
import { loadSession, saveSession, clearSession } from '@/lib/secure-storage';
import { supabase } from '@/lib/supabase';
import { enqueueOfflineRequest } from '@/services/offline/queue';
import { logApiMetric } from '@/lib/observability';

export type ApiErrorCode =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'server'
  | 'unknown';

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status?: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  timeoutMs?: number;
  retries?: number;
  queueIfOffline?: boolean;
  path: string;
};

let refreshPromise: Promise<boolean> | null = null;
const requestQueue: (() => void)[] = [];

function flushQueue() {
  while (requestQueue.length) {
    const next = requestQueue.shift();
    next?.();
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        await clearSession();
        return false;
      }
      await saveSession({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at
          ? data.session.expires_at * 1000
          : undefined,
      });
      return true;
    } catch {
      await clearSession();
      return false;
    } finally {
      refreshPromise = null;
      flushQueue();
    }
  })();
  return refreshPromise;
}

function mapStatus(status: number): ApiErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422 || status === 400) return 'validation';
  if (status >= 500) return 'server';
  return 'unknown';
}

export async function apiRequest<T>(options: RequestOptions): Promise<T> {
  const started = Date.now();
  const method = options.method ?? 'GET';
  const url = `${env.apiBaseUrl.replace(/\/$/, '')}/${options.path.replace(/^\//, '')}`;
  const retries = options.retries ?? API_MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? API_TIMEOUT_MS;

  let attempt = 0;
  while (true) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Dalily-Client': 'mobile',
        'X-Dalily-Api-Version': env.apiVersion,
        ...options.headers,
      };

      if (options.auth !== false) {
        const session = await loadSession();
        if (session?.accessToken) {
          headers.Authorization = `Bearer ${session.accessToken}`;
        }
      }

      const response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 401 && options.auth !== false) {
        const refreshed = await refreshAccessToken();
        if (refreshed && attempt <= retries + 1) {
          continue;
        }
        throw new ApiError('unauthorized', 'Session expired', 401);
      }

      const text = await response.text();
      const data = text ? (JSON.parse(text) as unknown) : null;

      if (!response.ok) {
        throw new ApiError(
          mapStatus(response.status),
          `Request failed (${response.status})`,
          response.status,
          data,
        );
      }

      logApiMetric({
        path: options.path,
        method,
        status: response.status,
        latencyMs: Date.now() - started,
      });
      return data as T;
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const isNetwork =
        err instanceof TypeError ||
        (err instanceof Error && /network/i.test(err.message));

      if (
        (isNetwork || isAbort) &&
        featureFlags.offlineQueue &&
        options.queueIfOffline &&
        method !== 'GET'
      ) {
        await enqueueOfflineRequest({
          path: options.path,
          method,
          body: options.body,
          headers: options.headers,
        });
        throw new ApiError('network', 'Queued for offline sync');
      }

      if (attempt <= retries && (isNetwork || isAbort)) {
        await new Promise((r) => setTimeout(r, 300 * attempt));
        continue;
      }

      if (isAbort) throw new ApiError('timeout', 'Request timed out');
      if (err instanceof ApiError) throw err;
      throw new ApiError('unknown', err instanceof Error ? err.message : 'Unknown error');
    }
  }
}
