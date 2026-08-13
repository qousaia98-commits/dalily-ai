import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { BookingDraft } from '@/features/customer/types';

const FAV_PROVIDERS_KEY = 'dalily.customer.fav.providers';
const FAV_CATEGORIES_KEY = 'dalily.customer.fav.categories';
const SEARCH_HISTORY_KEY = 'dalily.customer.search.history';
const RECENT_PROVIDERS_KEY = 'dalily.customer.recent.providers';

type FavoritesState = {
  providerIds: string[];
  categoryIds: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggleProvider: (id: string) => Promise<void>;
  toggleCategory: (id: string) => Promise<void>;
  isProviderFavorite: (id: string) => boolean;
  isCategoryFavorite: (id: string) => boolean;
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  providerIds: [],
  categoryIds: [],
  hydrated: false,
  hydrate: async () => {
    const [p, c] = await Promise.all([
      AsyncStorage.getItem(FAV_PROVIDERS_KEY),
      AsyncStorage.getItem(FAV_CATEGORIES_KEY),
    ]);
    set({
      providerIds: p ? (JSON.parse(p) as string[]) : [],
      categoryIds: c ? (JSON.parse(c) as string[]) : [],
      hydrated: true,
    });
  },
  toggleProvider: async (id) => {
    const next = get().providerIds.includes(id)
      ? get().providerIds.filter((x) => x !== id)
      : [...get().providerIds, id];
    set({ providerIds: next });
    await AsyncStorage.setItem(FAV_PROVIDERS_KEY, JSON.stringify(next));
  },
  toggleCategory: async (id) => {
    const next = get().categoryIds.includes(id)
      ? get().categoryIds.filter((x) => x !== id)
      : [...get().categoryIds, id];
    set({ categoryIds: next });
    await AsyncStorage.setItem(FAV_CATEGORIES_KEY, JSON.stringify(next));
  },
  isProviderFavorite: (id) => get().providerIds.includes(id),
  isCategoryFavorite: (id) => get().categoryIds.includes(id),
}));

type SearchState = {
  history: string[];
  recentProviderIds: string[];
  hydrate: () => Promise<void>;
  addQuery: (q: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  markProviderViewed: (id: string) => Promise<void>;
};

export const useSearchStore = create<SearchState>((set, get) => ({
  history: [],
  recentProviderIds: [],
  hydrate: async () => {
    const [h, r] = await Promise.all([
      AsyncStorage.getItem(SEARCH_HISTORY_KEY),
      AsyncStorage.getItem(RECENT_PROVIDERS_KEY),
    ]);
    set({
      history: h ? (JSON.parse(h) as string[]) : [],
      recentProviderIds: r ? (JSON.parse(r) as string[]) : [],
    });
  },
  addQuery: async (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const next = [trimmed, ...get().history.filter((x) => x !== trimmed)].slice(0, 12);
    set({ history: next });
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  },
  clearHistory: async () => {
    set({ history: [] });
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
  },
  markProviderViewed: async (id) => {
    const next = [id, ...get().recentProviderIds.filter((x) => x !== id)].slice(0, 20);
    set({ recentProviderIds: next });
    await AsyncStorage.setItem(RECENT_PROVIDERS_KEY, JSON.stringify(next));
  },
}));

type BookingDraftState = {
  draft: BookingDraft | null;
  setDraft: (draft: BookingDraft) => void;
  updateDraft: (patch: Partial<BookingDraft>) => void;
  clearDraft: () => void;
};

export const useBookingDraftStore = create<BookingDraftState>((set, get) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  updateDraft: (patch) => {
    const current = get().draft;
    if (!current) return;
    set({ draft: { ...current, ...patch } });
  },
  clearDraft: () => set({ draft: null }),
}));
