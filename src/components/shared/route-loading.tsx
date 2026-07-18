import { BrandLoading } from "@/components/brand/brand-loading";
import { Skeleton } from "@/components/ui/skeleton";

/** Shared route-level loading shell for dashboards and hubs. */
export function RouteLoading({ label }: { label?: string }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 animate-pulse px-1 py-2">
      <div className="flex justify-center py-6 sm:justify-start">
        <BrandLoading label={label} className="py-2" />
      </div>
      <Skeleton className="h-8 w-48 rounded-xl" />
      <Skeleton className="h-4 w-full max-w-md rounded-lg" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-40 rounded-3xl" />
      <Skeleton className="h-28 rounded-3xl" />
    </div>
  );
}
