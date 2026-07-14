"use client";

import * as LucideIcons from "lucide-react";
import { HelpCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function toPascalCase(iconName: string): string {
  return iconName
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function resolveLucideIcon(name: string | null | undefined): LucideIcon {
  if (!name) return HelpCircle;
  const key = toPascalCase(name);
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  return icons[key] ?? HelpCircle;
}

type CategoryIconProps = {
  name: string | null | undefined;
  className?: string;
};

export function CategoryIcon({ name, className }: CategoryIconProps) {
  const Icon = resolveLucideIcon(name);
  return <Icon className={cn("size-5", className)} aria-hidden />;
}
