"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";

export function LogoutButton({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const t = useTranslations("auth");
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={isPending}
      className="gap-2"
      onClick={() => startTransition(() => logoutAction())}
    >
      <LogOut className="size-4" />
      {t("logout")}
    </Button>
  );
}
