"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, MoreHorizontal } from "lucide-react";
import {
  deleteProviderAction,
  updateProviderStatusAction,
} from "@/actions/admin.actions";
import type { AdminProviderItem } from "@/lib/admin/queries";
import { getLocalizedField } from "@/types/provider.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/lib/i18n/routing";

type AdminProviderTableProps = {
  items: AdminProviderItem[];
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "suspended" || status === "archived") return "destructive";
  return "secondary";
}

export function AdminProviderTable({ items }: AdminProviderTableProps) {
  const t = useTranslations("admin.providers");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">{t("empty")}</CardContent>
      </Card>
    );
  }

  function runAction(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{getLocalizedField(item.name, locale)}</p>
                <Badge variant={statusVariant(item.status)}>{t(`status.${item.status}`)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {getLocalizedField(item.cityName, locale)} · {getLocalizedField(item.categoryName, locale)}
              </p>
              <p className="text-sm text-muted-foreground">
                {item.ownerDisplayName ?? item.ownerEmail}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" asChild className="gap-2">
                <Link href={`/admin/providers/${item.id}`}>
                  <ExternalLink className="size-4" />
                  {t("viewProfile")}
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={pending}>
                    {pending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => runAction(() => updateProviderStatusAction(item.id, "active"))}
                  >
                    {t("actions.activate")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => runAction(() => updateProviderStatusAction(item.id, "suspended"))}
                  >
                    {t("actions.suspend")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => runAction(() => updateProviderStatusAction(item.id, "archived"))}
                  >
                    {t("actions.archive")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => {
                      if (window.confirm(t("actions.deleteConfirm"))) {
                        runAction(() => deleteProviderAction(item.id));
                      }
                    }}
                  >
                    {t("actions.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
