import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand/tokens";
import { DalilyMark } from "@/components/brand/dalily-mark";

type DalilyLogoProps = {
  className?: string;
  variant?: "compact" | "full" | "horizontal" | "mark";
  onDark?: boolean;
  markSize?: number;
};

export function DalilyLogo({
  className,
  variant = "compact",
  onDark,
  markSize,
}: DalilyLogoProps) {
  const size =
    markSize ??
    (variant === "compact" ? BRAND.logo.markSizeMobile : BRAND.logo.markSizeDesktop);

  if (variant === "mark") {
    return <DalilyMark className={className} size={size} color={onDark ? "light" : undefined} />;
  }

  const titleClass = onDark
    ? "text-[#F7F8FA]"
    : "text-[var(--dalily-navy)] dark:text-[#F7F8FA]";
  const taglineMuted = onDark ? "text-[#F7F8FA]/55" : "text-[var(--dalily-muted)]";

  const showArabic = variant === "full" || variant === "horizontal";
  const showTagline = variant === "horizontal";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <DalilyMark size={size} color={onDark ? "light" : undefined} className="shrink-0" />
      <span className="flex min-w-0 flex-col justify-center gap-0.5 leading-none">
        <span
          className={cn(
            "font-sans text-[1.0625rem] font-bold tracking-tight sm:text-xl",
            titleClass,
          )}
        >
          {BRAND.name}
        </span>
        {showArabic ? (
          <span
            className="font-arabic text-[0.8125rem] font-semibold tracking-wide text-[var(--dalily-gold)] sm:text-sm"
            dir="rtl"
            lang="ar"
          >
            {BRAND.nameAr}
          </span>
        ) : null}
        {showTagline ? (
          <span
            className={cn(
              "mt-1 hidden font-sans text-[10px] font-semibold tracking-[0.16em] uppercase lg:block",
              taglineMuted,
            )}
          >
            FROM PROBLEM{" "}
            <span className="text-[var(--dalily-gold)]">TO</span> SOLUTION
          </span>
        ) : null}
      </span>
    </span>
  );
}
