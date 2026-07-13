import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ProviderStatus } from "@/types/database.types";

const variantMap: Record<ProviderStatus, "secondary" | "outline" | "success" | "destructive"> = {
  draft: "secondary",
  pending_review: "outline",
  active: "success",
  suspended: "destructive",
  archived: "destructive",
};

export function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  const t = useTranslations("business.status");
  return <Badge variant={variantMap[status]}>{t(status)}</Badge>;
}
