import { create } from 'zustand';
import type { CalendarView, JobStatus } from '@/features/provider/types';

type ProviderUiState = {
  jobFilter: JobStatus | 'all';
  calendarView: CalendarView;
  setJobFilter: (jobFilter: JobStatus | 'all') => void;
  setCalendarView: (calendarView: CalendarView) => void;
};

export const useProviderUiStore = create<ProviderUiState>((set) => ({
  jobFilter: 'all',
  calendarView: 'day',
  setJobFilter: (jobFilter) => set({ jobFilter }),
  setCalendarView: (calendarView) => set({ calendarView }),
}));
