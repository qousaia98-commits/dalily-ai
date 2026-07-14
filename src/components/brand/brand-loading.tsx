import { cn } from "@/lib/utils";
import { DalilyMark } from "@/components/brand/dalily-mark";

export function BrandLoading({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-4", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <DalilyMark size={48} className="animate-pulse text-[var(--dalily-navy)] dark:text-white" />
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
      <span className="sr-only">{label ?? "Loading"}</span>
    </div>
  );
}
