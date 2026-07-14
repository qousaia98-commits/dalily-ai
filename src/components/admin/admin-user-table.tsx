"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  changeUserRoleAction,
  updateUserStatusAction,
} from "@/actions/admin.actions";
import type { AdminUserItem } from "@/lib/admin/queries";
import type { AppRole } from "@/types/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type AdminUserTableProps = {
  items: AdminUserItem[];
};

const ROLE_OPTIONS: AppRole[] = ["user", "business", "admin"];

export function AdminUserTable({ items }: AdminUserTableProps) {
  const t = useTranslations("admin.users");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">{t("empty")}</CardContent>
      </Card>
    );
  }

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{item.displayName ?? item.email}</p>
                <Badge variant={item.status === "active" ? "default" : "destructive"}>
                  {t(`status.${item.status}`)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{item.email}</p>
              <div className="flex flex-wrap gap-1">
                {item.roles.map((role) => (
                  <Badge key={role} variant="outline">
                    {t(`roles.${role}`)}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.status === "active" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => updateUserStatusAction(item.id, "suspended"))}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : t("actions.disable")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => updateUserStatusAction(item.id, "active"))}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : t("actions.activate")}
                </Button>
              )}
              {ROLE_OPTIONS.map((role) => {
                const hasRole = item.roles.includes(role);
                return (
                  <Button
                    key={role}
                    size="sm"
                    variant={hasRole ? "secondary" : "ghost"}
                    disabled={pending}
                    onClick={() => run(() => changeUserRoleAction(item.id, role, !hasRole))}
                  >
                    {hasRole ? t("actions.revokeRole", { role: t(`roles.${role}`) }) : t("actions.grantRole", { role: t(`roles.${role}`) })}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
