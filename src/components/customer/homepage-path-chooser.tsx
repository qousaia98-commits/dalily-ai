import type { ReactNode } from "react";
import { ClipboardList, Search, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

type HomepagePathChooserProps = {
  className?: string;
};

/**
 * Homepage hero path chooser — two decisive cards, no AI textarea.
 * Publish → intake flow; Find → same-page browse section (#browse-services).
 */
export async function HomepagePathChooser({ className }: HomepagePathChooserProps) {
  const t = await getTranslations("home.pathChooser");

  return (
    <div
      className={cn(
        "grid w-full max-w-3xl gap-3 sm:grid-cols-2 sm:gap-4",
        className,
      )}
    >
      <PathCard
        href="/request/new?mode=publish"
        title={t("publish.title")}
        body={t("publish.body")}
        cta={t("publish.cta")}
        icon={<ClipboardList className="size-5" aria-hidden />}
        featured
        className="animate-fade-in-up stagger-2"
      />
      <PathCard
        href="#browse-services"
        title={t("find.title")}
        body={t("find.body")}
        cta={t("find.cta")}
        icon={<Search className="size-5" aria-hidden />}
        className="animate-fade-in-up stagger-3"
      />
    </div>
  );
}

function PathCard({
  href,
  title,
  body,
  cta,
  icon,
  featured = false,
  className,
}: {
  href: string;
  title: string;
  body: string;
  cta: string;
  icon: ReactNode;
  featured?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-[11.5rem] flex-col gap-3 overflow-hidden rounded-3xl border p-5 text-start sm:min-h-[12.5rem] sm:p-6",
        "transition-[border-color,box-shadow,transform] duration-200 ease-out",
        "hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100",
        featured
          ? "dalily-glass border-[var(--dalily-gold)]/45 shadow-[0_14px_40px_-24px_rgba(0,0,0,0.4)] hover:border-[var(--dalily-gold)]/65"
          : "border-border/70 bg-card/90 hover:border-[var(--dalily-gold)]/40",
        className,
      )}
    >
      {featured ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -end-8 -top-10 size-32 rounded-full bg-[color-mix(in_oklab,var(--dalily-gold)_18%,transparent)] blur-2xl"
        />
      ) : null}

      <div className="relative flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-2xl",
            featured
              ? "bg-[color-mix(in_oklab,var(--dalily-gold)_16%,transparent)] text-[var(--dalily-gold)]"
              : "bg-muted text-foreground",
          )}
        >
          {icon}
        </span>
      </div>

      <div className="relative space-y-1.5">
        <p className="text-lg font-semibold tracking-tight">{title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>

      <span
        className={cn(
          "relative mt-auto inline-flex items-center gap-1.5 text-sm font-semibold",
          featured ? "text-[var(--dalily-gold)]" : "text-foreground",
        )}
      >
        {cta}
        <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none" />
      </span>
    </Link>
  );
}
