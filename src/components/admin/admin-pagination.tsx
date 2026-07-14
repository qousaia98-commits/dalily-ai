import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";

type AdminPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
  label: string;
};

export function AdminPagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
  label,
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function buildHref(nextPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className="flex items-center justify-between gap-4 border-t pt-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
          {page > 1 ? <Link href={buildHref(page - 1)}>←</Link> : <span>←</span>}
        </Button>
        <span className="flex items-center px-2 text-sm text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
          {page < totalPages ? <Link href={buildHref(page + 1)}>→</Link> : <span>→</span>}
        </Button>
      </div>
    </div>
  );
}
