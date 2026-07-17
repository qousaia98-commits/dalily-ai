"use client";

import { useEffect, useRef } from "react";
import { trackProviderEngagementAction } from "@/actions/engagement.actions";

/** Fires a single profile_view when the public profile mounts. */
export function TrackProfileView({ providerId }: { providerId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void trackProviderEngagementAction({
      providerId,
      eventType: "profile_view",
    });
  }, [providerId]);
  return null;
}
