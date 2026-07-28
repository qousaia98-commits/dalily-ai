import type { CustomerBooking } from '@/features/customer/types';

const localBookings: CustomerBooking[] = [];

export function rememberLocalBooking(booking: CustomerBooking): void {
  localBookings.unshift(booking);
}

export function listLocalBookings(): CustomerBooking[] {
  return [...localBookings];
}

export function getLocalBooking(id: string): CustomerBooking | null {
  return localBookings.find((b) => b.id === id) ?? null;
}
