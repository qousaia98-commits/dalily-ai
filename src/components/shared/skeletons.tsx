import { Skeleton } from "@/components/ui/skeleton";

export function SearchResultsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border">
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="space-y-3 p-4">
              <div className="flex gap-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProviderProfileSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-48 w-full rounded-2xl sm:h-64" />
      <div className="flex gap-4">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

/** Waiting room / offer board — matches card layout, no spinner. */
export function WaitingRoomSkeleton({ label }: { label?: string }) {
  return (
    <div
      className="mx-auto w-full max-w-lg space-y-5 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      {label ? <p className="sr-only">{label}</p> : null}
      <div className="flex flex-col items-center gap-3 text-center">
        <Skeleton className="size-28 rounded-2xl" />
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-4 w-64 max-w-full rounded-lg" />
      </div>
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 flex-1 rounded-xl" />
      </div>
    </div>
  );
}

/** Compact inline panel loading (prefs, badge details, graphs). */
export function InlinePanelSkeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={className} aria-busy="true">
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton
            key={i}
            className={i === 0 ? "h-4 w-2/3 rounded-lg" : "h-3 w-full rounded-md"}
          />
        ))}
      </div>
    </div>
  );
}
