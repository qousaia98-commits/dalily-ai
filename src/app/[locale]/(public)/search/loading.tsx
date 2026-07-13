import { SearchResultsSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </header>
        <Skeleton className="mb-8 h-12 w-full rounded-xl" />
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="lg:w-64 lg:shrink-0">
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <div className="min-w-0 flex-1">
            <SearchResultsSkeleton />
          </div>
        </div>
      </div>
    </main>
  );
}
