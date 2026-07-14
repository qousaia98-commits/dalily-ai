import { SearchResultsSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLoading } from "@/components/brand/brand-loading";

export default function SearchLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex justify-center sm:justify-start">
          <BrandLoading className="py-4" />
        </div>
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
