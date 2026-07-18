import { CheckCircle2 } from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
};

/** Celebratory success moment after key marketplace actions. */
export function SuccessMoment({ title, body, ctaHref, ctaLabel, className }: Props) {
  return (
    <div
      role="status"
      className={cn(
        "animate-fade-in space-y-4 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center shadow-sm",
        className,
      )}
    >
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-6" aria-hidden />
      </span>
      <div className="space-y-1.5">
        <p className="text-base font-bold text-foreground">{title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      {ctaHref && ctaLabel ? (
        <Button asChild className="min-h-11 w-full rounded-2xl sm:w-auto">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
