"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Images } from "lucide-react";
import type { PublicPortfolioItem } from "@/lib/providers/public-profile";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  items: PublicPortfolioItem[];
  alt: string;
};

/** Lazy-load portfolio with fullscreen preview. Video slots are future-ready. */
export function ProviderGalleryLazy({ items, alt }: Props) {
  const t = useTranslations("provider");
  const [active, setActive] = useState<PublicPortfolioItem | null>(null);

  if (items.length === 0) {
    return (
      <section id="provider-gallery">
        <h2 className="mb-3 text-lg font-semibold">{t("gallery")}</h2>
        <EmptyState
          icon={Images}
          title={t("galleryEmptyTitle")}
          body={t("galleryEmptyBody")}
        />
      </section>
    );
  }

  return (
    <section id="provider-gallery">
      <h2 className="mb-3 text-lg font-semibold">{t("gallery")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, index) => (
          <LazyTile
            key={item.id}
            item={item}
            alt={alt}
            priority={index < 2}
            onOpen={() => {
              if (item.kind !== "video") setActive(item);
            }}
          />
        ))}
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label={t("galleryFullscreen")}
          onClick={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setActive(null);
          }}
        >
          <button
            type="button"
            className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label={t("galleryClose")}
            onClick={() => setActive(null)}
          >
            <X className="size-5" />
          </button>
          <div
            className="relative h-[min(80vh,720px)] w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={active.url}
              alt={alt}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LazyTile({
  item,
  alt,
  priority,
  onOpen,
}: {
  item: PublicPortfolioItem;
  alt: string;
  priority?: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("provider");
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(Boolean(priority));

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-muted/40 text-start outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
    >
      {item.kind !== "gallery" ? (
        <Badge
          className={cn(
            "absolute start-2 top-2 z-10 text-[0.65rem]",
            item.kind === "before" && "bg-muted text-foreground",
            item.kind === "after" && "bg-emerald-600 text-white",
            item.kind === "video" && "bg-[var(--dalily-navy)] text-white",
          )}
        >
          {t(`portfolioKind.${item.kind}`)}
        </Badge>
      ) : null}
      {item.kind === "video" ? (
        <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
          {t("portfolioKind.videoSoon")}
        </div>
      ) : visible ? (
        <Image
          src={item.url}
          alt={alt}
          fill
          loading={priority ? "eager" : "lazy"}
          className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:group-hover:scale-100"
          sizes="(max-width: 640px) 50vw, 33vw"
        />
      ) : null}
    </button>
  );
}
