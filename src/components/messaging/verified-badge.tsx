import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Blue verified check — only for official system accounts.
 */
export function VerifiedBadge({
  className,
  size = "md",
  label,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const dim =
    size === "sm" ? "size-3.5" : size === "lg" ? "size-5" : "size-4";
  const icon = size === "sm" ? "size-2" : size === "lg" ? "size-3" : "size-2.5";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-[#1D9BF0] text-white",
        dim,
        className,
      )}
      title={label}
      aria-label={label ?? "Verified"}
    >
      <Check className={cn(icon, "stroke-[3]")} aria-hidden />
    </span>
  );
}
