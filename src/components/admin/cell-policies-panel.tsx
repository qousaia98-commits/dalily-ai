"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CellPolicyView } from "@/domains/admin/cell-policies";
import { upsertCellPolicyAction } from "@/actions/admin-ops.actions";

export function CellPoliciesPanel({
  policies,
  cities,
  categories,
}: {
  policies: CellPolicyView[];
  cities: { id: string; label: string }[];
  categories: { id: string; label: string }[];
}) {
  const t = useTranslations("admin.cells");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-8">
      <form
        className="space-y-3 rounded-2xl border border-border bg-card p-4"
        action={(fd) => {
          startTransition(async () => {
            await upsertCellPolicyAction(fd);
            router.refresh();
          });
        }}
      >
        <h2 className="text-sm font-semibold">{t("upsertTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="cityId">{t("city")}</Label>
            <select
              id="cityId"
              name="cityId"
              required
              className="border-input flex h-10 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">{t("select")}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="categoryId">{t("category")}</Label>
            <select
              id="categoryId"
              name="categoryId"
              required
              className="border-input flex h-10 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">{t("select")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="frozen" value="true" />
            {t("frozen")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="limitedAvailability" value="true" />
            {t("limited")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="concierge" value="true" />
            {t("concierge")}
          </label>
        </div>
        <div className="space-y-1">
          <Label htmlFor="reason">{t("reason")}</Label>
          <Input id="reason" name="reason" required minLength={5} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="note">{t("note")}</Label>
          <Input id="note" name="note" />
        </div>
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("listTitle")}</h2>
        {policies.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {policies.map((p) => (
              <li key={p.cellKey} className="rounded-xl border border-border px-3 py-2">
                <p className="font-mono text-xs">{p.cellKey}</p>
                <p className="text-muted-foreground">
                  {p.frozen ? t("frozen") : null}
                  {p.limitedAvailability ? ` · ${t("limited")}` : null}
                  {p.concierge ? ` · ${t("concierge")}` : null}
                </p>
                {p.note ? <p>{p.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
