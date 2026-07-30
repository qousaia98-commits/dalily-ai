"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { PublicVisibilityFlags } from "@/lib/providers/public-visibility";
import { updatePublicVisibilityAction } from "@/actions/provider-privacy.actions";

const KEYS: (keyof PublicVisibilityFlags)[] = [
  "showLogo",
  "showGallery",
  "showCompletedJobs",
  "showServiceArea",
  "showStatistics",
  "showLanguages",
  "showCertificates",
];

export function PublicVisibilitySettingsForm({
  initial,
}: {
  initial: PublicVisibilityFlags;
}) {
  const t = useTranslations("business.publicVisibility");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof PublicVisibilityFlags) {
    setValues((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updatePublicVisibilityAction(values);
      if (!result.success) {
        setError(result.error ?? "failed");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ul className="space-y-2">
        {KEYS.map((key) => (
          <li key={key}>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2.5 text-sm">
              <span>{t(`flags.${key}`)}</span>
              <input
                type="checkbox"
                className="size-4 accent-[var(--dalily-gold)]"
                checked={values[key]}
                onChange={() => toggle(key)}
              />
            </label>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        className="rounded-xl"
        disabled={pending}
        onClick={save}
      >
        {pending ? t("saving") : t("save")}
      </Button>
      {saved ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">{t("saved")}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {t("error")}
        </p>
      ) : null}
    </section>
  );
}
