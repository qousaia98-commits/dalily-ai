import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: number;
};

export function AdminStatCard({ label, value }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tracking-tight">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

type AdminStatGridProps = {
  stats: {
    totalProviders: number;
    activeProviders: number;
    pendingReviews: number;
    rejectedProviders: number;
    totalUsers: number;
    totalSearches: number;
    searchesToday: number;
  };
  labels: {
    totalProviders: string;
    activeProviders: string;
    pendingReviews: string;
    rejectedProviders: string;
    totalUsers: string;
    totalSearches: string;
    searchesToday: string;
  };
};

export function AdminStatGrid({ stats, labels }: AdminStatGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AdminStatCard label={labels.totalProviders} value={stats.totalProviders} />
      <AdminStatCard label={labels.activeProviders} value={stats.activeProviders} />
      <AdminStatCard label={labels.pendingReviews} value={stats.pendingReviews} />
      <AdminStatCard label={labels.rejectedProviders} value={stats.rejectedProviders} />
      <AdminStatCard label={labels.totalUsers} value={stats.totalUsers} />
      <AdminStatCard label={labels.totalSearches} value={stats.totalSearches} />
      <AdminStatCard label={labels.searchesToday} value={stats.searchesToday} />
    </div>
  );
}
