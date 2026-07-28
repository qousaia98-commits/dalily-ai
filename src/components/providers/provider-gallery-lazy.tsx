"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  images: string[];
  alt: string;
};

/** Lazy-loads gallery tiles when they enter the viewport. */
export function ProviderGalleryLazy({ images, alt }: Props) {
  const t = useTranslations("provider");
  if (images.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t("gallery")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <LazyTile key={`${image}-${index}`} src={image} alt={alt} priority={index < 2} />
        ))}
      </div>
    </section>
  );
}

function LazyTile({
  src,
  alt,
  priority,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
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
    <div
      ref={ref}
      className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted/40"
    >
      {visible ? (
        <Image
          src={src}
          alt={alt}
          fill
          loading={priority ? "eager" : "lazy"}
          className="object-cover transition-transform hover:scale-105 motion-reduce:hover:scale-100"
          sizes="(max-width: 640px) 50vw, 33vw"
        />
      ) : null}
    </div>
  );
}
