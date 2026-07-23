"use client";

import dynamic from "next/dynamic";
import type { ChartPoint } from "@/lib/provider-success/types";

const SuccessCharts = dynamic(
  () =>
    import("@/components/provider-success/success-charts").then((m) => m.SuccessCharts),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        …
      </div>
    ),
  },
);

export function SuccessChartsLazy(props: {
  bookingsPerWeek: ChartPoint[];
  bookingsPerMonth: ChartPoint[];
  ratingTrend: ChartPoint[];
  completedJobsTrend: ChartPoint[];
}) {
  return <SuccessCharts {...props} />;
}
