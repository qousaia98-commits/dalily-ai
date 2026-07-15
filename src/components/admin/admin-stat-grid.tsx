import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: number;
};

export function AdminStatCard({ label, value }: StatCardProps) {
  return (
    <Card className="rounded-2xl">
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
    pendingPayments: number;
    pendingVerifications: number;
    recentRegistrations: number;
    recentApprovals: number;
    averageHealthScore: number;
  };
  labels: Record<keyof AdminStatGridProps["stats"], string>;
};

export function AdminStatGrid({ stats, labels }: AdminStatGridProps) {
  const keys = Object.keys(labels) as (keyof AdminStatGridProps["stats"])[];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {keys.map((key) => (
        <AdminStatCard key={key} label={labels[key]} value={stats[key]} />
      ))}
    </div>
  );
}
