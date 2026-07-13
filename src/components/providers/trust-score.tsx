import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type TrustScoreProps = {
  score: number;
  verified?: boolean;
  size?: "sm" | "md" | "lg";
  showBar?: boolean;
  className?: string;
};

export async function TrustScore({
  score,
  verified = false,
  size = "md",
  showBar = false,
  className,
}: TrustScoreProps) {
  const t = await getTranslations("provider");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-bold text-primary",
            size === "sm" && "text-sm",
            size === "md" && "text-base",
            size === "lg" && "text-2xl",
          )}
        >
          {score}%
        </span>
        <span
          className={cn(
            "text-muted-foreground",
            size === "lg" ? "text-sm" : "text-xs",
          )}
        >
          {t("trustScore")}
        </span>
        {verified ? (
          <Badge variant="success" className="gap-1">
            <ShieldCheck className="size-3" />
            {t("verified")}
          </Badge>
        ) : null}
      </div>
      {showBar ? <Progress value={score} className="h-1.5" /> : null}
    </div>
  );
}
