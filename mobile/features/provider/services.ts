/**
 * Provider services — demo + optional Supabase.
 * Never expose confidential marketplace information.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { env, featureFlags } from '@/constants/env';
import {
  DEMO_AI_INSIGHTS,
  DEMO_AVAILABILITY,
  DEMO_JOBS,
  DEMO_MESSAGES,
  DEMO_PROFILE,
  demoAnalytics,
  demoAssistant,
  demoCalendarBlocks,
  demoDashboard,
} from '@/features/provider/demo-data';
import type {
  AvailabilityWindow,
  CalendarBlock,
  JobStatus,
  ProviderAiInsight,
  ProviderAnalytics,
  ProviderAssistantSnapshot,
  ProviderDashboard,
  ProviderJob,
  ProviderMessage,
  ProviderProfileInfo,
} from '@/features/provider/types';
import { enqueueOfflineRequest } from '@/services/offline/queue';

const JOBS_CACHE_KEY = 'dalily.provider.jobs.cache';
const REC_STATUS_KEY = 'dalily.provider.recs.status';

function hasBackend(): boolean {
  return Boolean(env.supabaseUrl && !env.supabaseUrl.includes('placeholder'));
}

let jobMemory = [...DEMO_JOBS];

export async function hydrateProviderJobsCache(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(JOBS_CACHE_KEY);
    if (raw) jobMemory = JSON.parse(raw) as ProviderJob[];
  } catch {
    /* keep demo */
  }
}

async function persistJobs(): Promise<void> {
  await AsyncStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(jobMemory));
}

export async function fetchProviderDashboard(): Promise<ProviderDashboard> {
  await hydrateProviderJobsCache();
  const base = demoDashboard();
  base.todaySchedule = jobMemory.filter(
    (j) => j.status === 'upcoming' || j.status === 'active',
  );
  base.upcomingCount = jobMemory.filter((j) => j.status === 'upcoming').length;

  if (!hasBackend()) return base;
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return base;
    // Soft enrich — keep provider-safe fields only
    return base;
  } catch {
    return base;
  }
}

export async function fetchProviderJobs(status?: JobStatus | 'all'): Promise<ProviderJob[]> {
  await hydrateProviderJobsCache();
  if (!status || status === 'all') return [...jobMemory];
  return jobMemory.filter((j) => j.status === status);
}

export async function fetchProviderJob(id: string): Promise<ProviderJob | null> {
  await hydrateProviderJobsCache();
  return jobMemory.find((j) => j.id === id) ?? null;
}

export async function updateJobStatus(
  id: string,
  status: JobStatus,
): Promise<ProviderJob | null> {
  await hydrateProviderJobsCache();
  const idx = jobMemory.findIndex((j) => j.id === id);
  if (idx < 0) return null;
  const current = jobMemory[idx]!;
  jobMemory[idx] = { ...current, status };
  await persistJobs();

  if (featureFlags.offlineQueue) {
    try {
      await enqueueOfflineRequest({
        path: `provider/jobs/${id}/status`,
        method: 'PATCH',
        body: { status },
      });
    } catch {
      /* soft */
    }
  }
  return jobMemory[idx] ?? null;
}

export async function fetchCalendarBlocks(): Promise<CalendarBlock[]> {
  return demoCalendarBlocks();
}

export async function fetchAvailability(): Promise<AvailabilityWindow[]> {
  return DEMO_AVAILABILITY;
}

export async function fetchAssistantSnapshot(): Promise<ProviderAssistantSnapshot> {
  const snap = demoAssistant();
  try {
    const raw = await AsyncStorage.getItem(REC_STATUS_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, 'accepted' | 'dismissed'>;
      snap.recommendations = snap.recommendations.map((r) =>
        map[r.id] ? { ...r, status: map[r.id]! } : r,
      );
    }
  } catch {
    /* ignore */
  }
  return snap;
}

export async function decideRecommendation(
  id: string,
  accept: boolean,
): Promise<void> {
  const raw = await AsyncStorage.getItem(REC_STATUS_KEY);
  const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  map[id] = accept ? 'accepted' : 'dismissed';
  await AsyncStorage.setItem(REC_STATUS_KEY, JSON.stringify(map));
}

export async function fetchAnalytics(): Promise<ProviderAnalytics> {
  return demoAnalytics();
}

export async function fetchMessages(): Promise<ProviderMessage[]> {
  return DEMO_MESSAGES;
}

export async function fetchProviderProfile(): Promise<ProviderProfileInfo> {
  return DEMO_PROFILE;
}

export async function fetchProviderAiInsights(): Promise<ProviderAiInsight[]> {
  if (!featureFlags.providerApp) return [];
  return DEMO_AI_INSIGHTS;
}
