"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Persistent floating entry to the AI intake chat (/request/new/chat) when
 * that feature is enabled; falls back to the plain intake flow otherwise
 * (chat is off by default — see isIntakeChatEnabled()).
 * Sits above the mobile bottom nav; bottom-end corner on desktop (RTL-safe).
 */
export function FloatingAiButton({
  className,
  chatEnabled = false,
}: {
  className?: string;
  chatEnabled?: boolean;
}) {
  const t = useTranslations("home.floatingAi");
  const pathname = usePathname();
  const href = chatEnabled ? "/request/new/chat" : "/request/new";

  // Hide on intake / chat so chrome does not stack on itself.
  if (pathname === "/request/new" || pathname === "/request/new/chat") {
    return null;
  }

  return (
    <Link
      href={href}
      aria-label={t("ariaLabel")}
      className={cn(
        "fixed z-[70] flex size-14 items-center justify-center rounded-full",
        "end-4 md:end-6",
        // Clear floating mobile nav + safe area; desktop uses a simple corner inset.
        "bottom-[calc(var(--dalily-mobile-nav-offset)+0.75rem)] md:bottom-6",
        "border border-[var(--dalily-gold)]/45",
        "bg-[var(--dalily-navy)] text-[var(--dalily-gold)] shadow-[0_12px_32px_-10px_rgba(11,21,38,0.55)]",
        "dark:bg-[color-mix(in_oklab,var(--dalily-navy-deep)_92%,var(--dalily-gold)_8%)]",
        "transition-[transform,box-shadow,border-color] duration-200 ease-out",
        "hover:border-[var(--dalily-gold)]/70 hover:shadow-[0_16px_40px_-12px_rgba(196,160,82,0.45)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
        "animate-ai-glow",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-[color-mix(in_oklab,var(--dalily-gold)_22%,transparent)] opacity-40 blur-md"
      />
      <Sparkles className="relative size-6" aria-hidden />
      <span className="sr-only">{t("label")}</span>
    </Link>
  );
}
