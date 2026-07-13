import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type StarRatingProps = {
  rating: number;
  size?: "sm" | "md";
  showValue?: boolean;
  className?: string;
};

export function StarRating({ rating, size = "sm", showValue = true, className }: StarRatingProps) {
  const iconSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Star className={cn(iconSize, "fill-amber-400 text-amber-400")} aria-hidden />
      {showValue ? (
        <span className={cn("font-medium", size === "sm" ? "text-sm" : "text-base")}>
          {rating.toFixed(1)}
        </span>
      ) : null}
    </div>
  );
}
