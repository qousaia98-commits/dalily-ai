import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

export type MobileHubLink = {
  href: string;
  title: string;
  description?: string;
  icon: LucideIcon;
};

type MobileHubLinksProps = {
  links: MobileHubLink[];
  className?: string;
};

export async function MobileHubLinks({ links, className }: MobileHubLinksProps) {
  const locale = await getLocale();
  const isRtl = locale === "ar";
  const Chevron = isRtl ? ChevronLeft : ChevronRight;

  return (
    <ul className={cn("overflow-hidden rounded-2xl border border-border/70 bg-card", className)}>
      {links.map((link, index) => {
        const Icon = link.icon;
        return (
          <li key={link.href} className={cn(index > 0 && "border-t border-border/70")}>
            <Link
              href={link.href}
              className="flex min-h-14 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/60 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--dalily-gold)]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--dalily-gold)_16%,transparent)] text-[var(--dalily-gold)]">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{link.title}</span>
                {link.description ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{link.description}</span>
                ) : null}
              </span>
              <Chevron className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
