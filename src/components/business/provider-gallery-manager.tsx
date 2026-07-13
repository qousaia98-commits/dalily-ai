"use client";

import { useActionState } from "react";
import { useRouter } from "@/lib/i18n/routing";
import Image from "next/image";
import { Loader2, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  uploadProviderImageAction,
  deleteGalleryImageAction,
  type ProviderActionState,
} from "@/actions/provider.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ManagedProvider } from "@/types/provider.types";

const initialState: ProviderActionState = { success: false };

export function ProviderGalleryManager({ provider }: { provider: ManagedProvider }) {
  const t = useTranslations("business.gallery");
  const router = useRouter();
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadProviderImageAction,
    initialState,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t("images", { count: provider.gallery.length })}</CardTitle>
          <form action={uploadAction} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <input type="hidden" name="providerId" value={provider.id} />
            <input type="hidden" name="kind" value="gallery" />
            <Input type="file" name="file" accept="image/*" required className="max-w-xs" />
            <Button type="submit" disabled={uploadPending} className="gap-2 shrink-0">
              {uploadPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {t("upload")}
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {uploadState.error ? (
            <p className="mb-4 text-sm text-destructive">
              {t(`errors.${uploadState.error}` as "errors.unknown")}
            </p>
          ) : null}
          {uploadState.success ? (
            <p className="mb-4 text-sm text-emerald-600 dark:text-emerald-400">{t("uploaded")}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {provider.gallery.map((image) => (
              <div key={image.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                <Image src={image.url} alt="" fill className="object-cover" sizes="200px" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    aria-label={t("remove")}
                    onClick={async () => {
                      await deleteGalleryImageAction(image.id);
                      router.refresh();
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground">
              <Upload className="size-6" />
              <span className="text-center text-sm px-2">{t("addImage")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
