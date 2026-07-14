import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { listPaymentsForAdmin, listSubscriptionsForAdmin } from "@/lib/subscription/repository";
import { AdminSubscriptionsPanel } from "@/components/admin/admin-subscriptions-panel";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    plan?: string;
    paymentStatus?: string;
    page?: string;
  }>;
};

export default async function AdminSubscriptionsPage({ searchParams }: PageProps) {
  await requireAdminUser();
  const t = await getTranslations("admin.subscriptions");
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;

  const statusOptions = ["all", "trial", "active", "pending_payment", "expired", "cancelled"] as const;
  const status =
    params.status && statusOptions.includes(params.status as (typeof statusOptions)[number])
      ? (params.status as (typeof statusOptions)[number])
      : "all";

  const planOptions = ["all", "free", "pro", "premium"] as const;
  const plan =
    params.plan && planOptions.includes(params.plan as (typeof planOptions)[number])
      ? (params.plan as (typeof planOptions)[number])
      : "all";

  const paymentStatusOptions = ["all", "pending", "paid", "failed", "cancelled"] as const;
  const paymentStatus =
    params.paymentStatus &&
    paymentStatusOptions.includes(params.paymentStatus as (typeof paymentStatusOptions)[number])
      ? (params.paymentStatus as (typeof paymentStatusOptions)[number])
      : "pending";

  const [subscriptions, payments] = await Promise.all([
    listSubscriptionsForAdmin({ search: params.q, status, planSlug: plan, page }),
    listPaymentsForAdmin({ status: paymentStatus, page }),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Input name="q" defaultValue={params.q ?? ""} placeholder={t("filters.search")} />
        <select
          name="status"
          defaultValue={status}
          className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {t(`filters.status.${s}`)}
            </option>
          ))}
        </select>
        <select
          name="plan"
          defaultValue={plan}
          className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        >
          {planOptions.map((p) => (
            <option key={p} value={p}>
              {t(`filters.plan.${p}`)}
            </option>
          ))}
        </select>
        <select
          name="paymentStatus"
          defaultValue={paymentStatus}
          className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        >
          {paymentStatusOptions.map((s) => (
            <option key={s} value={s}>
              {t(`filters.paymentStatus.${s}`)}
            </option>
          ))}
        </select>
        <Button type="submit">{t("filters.apply")}</Button>
      </form>

      <AdminSubscriptionsPanel subscriptions={subscriptions.items} payments={payments.items} />
      <AdminPagination
        page={subscriptions.page}
        pageSize={subscriptions.pageSize}
        total={subscriptions.total}
        basePath="/admin/subscriptions"
        searchParams={{
          q: params.q,
          status: params.status ?? status,
          plan: params.plan ?? plan,
          paymentStatus: params.paymentStatus ?? paymentStatus,
        }}
        label={t("pagination", { total: subscriptions.total })}
      />
    </div>
  );
}
