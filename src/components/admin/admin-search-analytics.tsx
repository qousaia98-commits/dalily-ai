import type { SearchAnalytics } from "@/lib/admin/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AdminSearchAnalyticsProps = {
  data: SearchAnalytics;
  labels: {
    topProblems: string;
    noResults: string;
    byCity: string;
    perDay: string;
    count: string;
    empty: string;
  };
};

function AnalyticsList({
  title,
  rows,
  empty,
  renderLabel,
}: {
  title: string;
  rows: { label: string; count: number }[];
  empty: string;
  renderLabel?: (label: string) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-4 text-sm">
                <span className="min-w-0 truncate">{renderLabel ? renderLabel(row.label) : row.label}</span>
                <span className="shrink-0 font-medium tabular-nums">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminSearchAnalytics({ data, labels }: AdminSearchAnalyticsProps) {
  const maxDay = Math.max(...data.perDay.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsList
          title={labels.topProblems}
          empty={labels.empty}
          rows={data.topProblems.map((r) => ({ label: r.key, count: r.count }))}
        />
        <AnalyticsList
          title={labels.noResults}
          empty={labels.empty}
          rows={data.noResults.map((r) => ({ label: r.query, count: r.count }))}
        />
        <AnalyticsList
          title={labels.byCity}
          empty={labels.empty}
          rows={data.byCity.map((r) => ({ label: r.city, count: r.count }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.perDay}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.perDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            <div className="space-y-2">
              {data.perDay.map((day) => (
                <div key={day.date} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-muted-foreground">{day.date}</span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.round((day.count / maxDay) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right font-medium tabular-nums">{day.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
