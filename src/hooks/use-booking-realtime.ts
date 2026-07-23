"use client";

import { useEffect } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/client";

type Options = {
  providerId?: string | null;
  customerId?: string | null;
  enabled?: boolean;
};

/**
 * Booking realtime: refresh on booking / availability / blocked-time changes.
 * Does not touch Chat / Reviews / Search modules.
 */
export function useBookingRealtime({
  providerId,
  customerId,
  enabled = true,
}: Options) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    if (!providerId && !customerId) return;

    const supabase = createClient();
    const channels: ReturnType<typeof supabase.channel>[] = [];
    const refresh = () => router.refresh();

    if (providerId) {
      channels.push(
        supabase
          .channel(`booking-provider-${providerId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "bookings",
              filter: `provider_id=eq.${providerId}`,
            },
            refresh,
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "provider_availability_settings",
              filter: `provider_id=eq.${providerId}`,
            },
            refresh,
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "provider_blocked_times",
              filter: `provider_id=eq.${providerId}`,
            },
            refresh,
          )
          .subscribe(),
      );
    }

    if (customerId) {
      channels.push(
        supabase
          .channel(`booking-customer-${customerId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "bookings",
              filter: `customer_id=eq.${customerId}`,
            },
            refresh,
          )
          .subscribe(),
      );
    }

    return () => {
      for (const ch of channels) {
        void supabase.removeChannel(ch);
      }
    };
  }, [providerId, customerId, enabled, router]);
}
