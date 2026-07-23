import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type BubbleProps = {
  children: React.ReactNode;
  className?: string;
};

export function AssistantBubble({ children, className }: BubbleProps) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--dalily-gold)_18%,var(--card))] text-[var(--dalily-gold)]"
      >
        <Sparkles className="size-3.5" />
      </span>
      <div className="max-w-[85%] rounded-2xl bg-muted/60 px-3.5 py-2.5 text-sm text-foreground">
        {children}
      </div>
    </div>
  );
}

export function UserBubble({ children }: BubbleProps) {
  return (
    <div className="flex justify-end ps-9">
      <div className="max-w-[85%] rounded-2xl bg-[var(--dalily-navy)] px-3.5 py-2.5 text-sm font-medium text-white">
        {children}
      </div>
    </div>
  );
}
