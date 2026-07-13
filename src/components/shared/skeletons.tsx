import { Skeleton } from "@/components/ui/skeleton";

export function SearchResultsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
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
