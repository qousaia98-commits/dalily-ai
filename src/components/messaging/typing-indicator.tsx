"use client";

import { useTranslations } from "next-intl";

export function TypingIndicator({ names }: { names: string[] }) {
  const t = useTranslations("messaging.typing");
  if (!names.length) return null;

  const label =
    names.length === 1
      ? t("one", { name: names[0] })
      : t("many", { count: names.length });

  return (
    <p className="px-4 py-1 text-xs text-muted-foreground" role="status" aria-live="polite">
      <span className="me-1 inline-flex gap-0.5" aria-hidden>
        <span className="size-1 animate-pulse rounded-full bg-muted-foreground" />
        <span className="size-1 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
        <span className="size-1 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
      </span>
      {label}
    </p>
  );
}
