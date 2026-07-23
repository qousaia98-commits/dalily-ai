"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  GripVertical,
  ImageIcon,
  Images,
  Loader2,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import {
  deleteGalleryImageAction,
  deleteProviderMediaAction,
  reorderGalleryImagesAction,
  setFeaturedGalleryImageAction,
  uploadProviderImageAction,
} from "@/actions/provider.actions";
import { compressImageFile, fileFingerprint } from "@/lib/media/compress-image";
import { MAX_GALLERY_IMAGES } from "@/lib/providers/constants";
import type { ManagedProvider, ProviderImage } from "@/types/provider.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type Props = {
  provider: ManagedProvider;
  maxImages: number;
};

type UploadItem = {
  id: string;
  name: string;
  previewUrl: string;
  progress: number;
  status: "compressing" | "uploading" | "done" | "error";
  error?: string;
};

function resolveError(
  t: ReturnType<typeof useTranslations>,
  code?: string,
): string {
  if (!code) return t("errors.unknown");
  try {
    return t(`errors.${code}` as "errors.unknown");
  } catch {
    return t("errors.unknown");
  }
}

function SingleMediaCard({
  kind,
  title,
  emptyCopy,
  currentUrl,
  providerId,
  aspectClass,
  roundedClass,
}: {
  kind: "avatar" | "cover";
  title: string;
  emptyCopy: string;
  currentUrl: string | null;
  providerId: string;
  aspectClass: string;
  roundedClass: string;
}) {
  const t = useTranslations("business.media");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, startTransition] = useTransition();
  const fingerprints = useRef(new Set<string>());

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pickFile(file: File | null) {
    if (!file) return;
    const fp = fileFingerprint(file);
    if (fingerprints.current.has(fp)) {
      toast.error(t("toasts.duplicate"));
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
    setProgress(0);
  }

  function clearPending() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPendingFile(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  function upload() {
    if (!pendingFile) return;
    const fp = fileFingerprint(pendingFile);
    startTransition(async () => {
      try {
        setProgress(15);
        const compressed = await compressImageFile(pendingFile, {
          maxEdge: kind === "avatar" ? 800 : 1920,
        });
        setProgress(45);
        const fd = new FormData();
        fd.set("providerId", providerId);
        fd.set("kind", kind);
        fd.set("file", compressed.file);
        setProgress(70);
        const result = await uploadProviderImageAction({ success: false }, fd);
        if (!result.success) {
          toast.error(resolveError(t, result.error));
          setProgress(0);
          return;
        }
        fingerprints.current.add(fp);
        setProgress(100);
        toast.success(kind === "avatar" ? t("toasts.logoUpdated") : t("toasts.coverUpdated"));
        clearPending();
        router.refresh();
      } catch {
        toast.error(t("errors.upload_failed"));
        setProgress(0);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteProviderMediaAction(kind);
      if (!result.success) {
        toast.error(resolveError(t, result.error));
        return;
      }
      toast.success(kind === "avatar" ? t("toasts.logoDeleted") : t("toasts.coverDeleted"));
      router.refresh();
    });
  }

  const displayUrl = preview ?? currentUrl;

  return (
    <section className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[var(--dalily-navy)]">{title}</h2>
        {currentUrl ? (
          <span className="text-xs font-medium text-emerald-700">{t("status.set")}</span>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">{t("status.optional")}</span>
        )}
      </div>

      <div
        className={cn(
          "relative overflow-hidden border border-dashed border-border/80 bg-muted/30",
          aspectClass,
          roundedClass,
        )}
      >
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt=""
            fill
            className="object-cover"
            sizes={kind === "avatar" ? "160px" : "(max-width: 768px) 100vw, 640px"}
            unoptimized={Boolean(preview)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <ImageIcon className="size-8 text-muted-foreground" aria-hidden />
            <p className="max-w-xs text-sm text-muted-foreground">{emptyCopy}</p>
          </div>
        )}
      </div>

      {busy && progress > 0 ? (
        <div className="mt-3 space-y-1">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">{t("uploading")}</p>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          {currentUrl || preview ? t("actions.replace") : t("actions.upload")}
        </Button>
        {preview ? (
          <Button type="button" disabled={busy} onClick={upload} className="gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("actions.confirmUpload")}
          </Button>
        ) : null}
        {preview ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={clearPending}>
            {t("actions.cancel")}
          </Button>
        ) : null}
        {currentUrl && !preview ? (
          <Button
            type="button"
            variant="ghost"
            className="gap-2 text-destructive hover:text-destructive"
            disabled={busy}
            onClick={remove}
          >
            <Trash2 className="size-4" aria-hidden />
            {t("actions.delete")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export function BusinessMediaManager({ provider, maxImages }: Props) {
  const t = useTranslations("business.media");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ProviderImage[]>(provider.gallery);
  const itemsRef = useRef(items);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [busy, startTransition] = useTransition();
  const fingerprints = useRef(new Set<string>());

  useEffect(() => {
    setItems(provider.gallery);
  }, [provider.gallery]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const galleryCap = Math.min(maxImages, MAX_GALLERY_IMAGES);
  const remaining = Math.max(0, galleryCap - items.length - uploads.filter((u) => u.status !== "done" && u.status !== "error").length);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        return a.sortOrder - b.sortOrder;
      }),
    [items],
  );

  const persistOrder = useCallback(
    (next: ProviderImage[]) => {
      const orderedIds = next.map((image) => image.id);
      startTransition(async () => {
        const result = await reorderGalleryImagesAction(orderedIds);
        if (!result.success) {
          toast.error(resolveError(t, result.error));
          setItems(provider.gallery);
          return;
        }
        toast.success(t("toasts.reordered"));
        router.refresh();
      });
    },
    [provider.gallery, router, t],
  );

  function onDragStart(id: string) {
    setDraggingId(id);
  }

  function onDragOver(overId: string) {
    if (!draggingId || draggingId === overId) return;
    setItems((prev) => {
      const from = prev.findIndex((image) => image.id === draggingId);
      const to = prev.findIndex((image) => image.id === overId);
      if (from < 0 || to < 0) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy.map((image, index) => ({ ...image, sortOrder: index }));
    });
  }

  function onDragEnd() {
    if (!draggingId) return;
    setDraggingId(null);
    persistOrder(itemsRef.current);
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    const slots = remaining;
    if (slots <= 0) {
      toast.error(t("errors.gallery_limit"));
      return;
    }

    const accepted = list.slice(0, slots);
    const queue: UploadItem[] = accepted.map((file, index) => ({
      id: `${fileFingerprint(file)}-${index}-${Date.now()}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      progress: 5,
      status: "compressing" as const,
    }));
    setUploads((prev) => [...prev, ...queue]);

    for (let i = 0; i < accepted.length; i++) {
      const file = accepted[i];
      const uploadId = queue[i].id;
      const fp = fileFingerprint(file);
      if (fingerprints.current.has(fp)) {
        setUploads((prev) =>
          prev.map((item) =>
            item.id === uploadId
              ? { ...item, status: "error", error: t("toasts.duplicate"), progress: 0 }
              : item,
          ),
        );
        continue;
      }

      try {
        setUploads((prev) =>
          prev.map((item) =>
            item.id === uploadId ? { ...item, status: "compressing", progress: 20 } : item,
          ),
        );
        const compressed = await compressImageFile(file, { maxEdge: 1600 });
        setUploads((prev) =>
          prev.map((item) =>
            item.id === uploadId ? { ...item, status: "uploading", progress: 55 } : item,
          ),
        );

        const fd = new FormData();
        fd.set("providerId", provider.id);
        fd.set("kind", "gallery");
        fd.set("file", compressed.file);
        const result = await uploadProviderImageAction({ success: false }, fd);

        if (!result.success) {
          setUploads((prev) =>
            prev.map((item) =>
              item.id === uploadId
                ? {
                    ...item,
                    status: "error",
                    error: resolveError(t, result.error),
                    progress: 0,
                  }
                : item,
            ),
          );
          toast.error(resolveError(t, result.error));
          continue;
        }

        fingerprints.current.add(fp);
        setUploads((prev) =>
          prev.map((item) =>
            item.id === uploadId ? { ...item, status: "done", progress: 100 } : item,
          ),
        );
        toast.success(t("toasts.uploadCompleted"));
      } catch {
        setUploads((prev) =>
          prev.map((item) =>
            item.id === uploadId
              ? { ...item, status: "error", error: t("errors.upload_failed"), progress: 0 }
              : item,
          ),
        );
        toast.error(t("errors.upload_failed"));
      }
    }

    router.refresh();
    setTimeout(() => {
      setUploads((prev) => {
        prev.forEach((item) => {
          if (item.status === "done") URL.revokeObjectURL(item.previewUrl);
        });
        return prev.filter((item) => item.status !== "done");
      });
    }, 800);
  }

  function removeImage(imageId: string) {
    startTransition(async () => {
      const result = await deleteGalleryImageAction(imageId);
      if (!result.success) {
        toast.error(resolveError(t, result.error));
        return;
      }
      setItems((prev) => prev.filter((image) => image.id !== imageId));
      toast.success(t("toasts.imageDeleted"));
      router.refresh();
    });
  }

  function setFeatured(imageId: string) {
    startTransition(async () => {
      const result = await setFeaturedGalleryImageAction(imageId);
      if (!result.success) {
        toast.error(resolveError(t, result.error));
        return;
      }
      setItems((prev) =>
        prev.map((image) => ({
          ...image,
          isFeatured: image.id === imageId,
        })),
      );
      toast.success(t("toasts.featuredUpdated"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <SingleMediaCard
          kind="avatar"
          title={t("logo.title")}
          emptyCopy={t("logo.empty")}
          currentUrl={provider.avatarUrl}
          providerId={provider.id}
          aspectClass="aspect-square max-w-[220px]"
          roundedClass="rounded-full"
        />
        <SingleMediaCard
          kind="cover"
          title={t("cover.title")}
          emptyCopy={t("cover.empty")}
          currentUrl={provider.coverUrl}
          providerId={provider.id}
          aspectClass="aspect-[16/9] w-full"
          roundedClass="rounded-2xl"
        />
      </div>

      <section className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--dalily-navy)]">{t("gallery.title")}</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t("gallery.subtitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("gallery.count", { count: items.length, max: galleryCap })}
            </p>
          </div>
          <Button
            type="button"
            className="gap-2"
            disabled={busy || remaining <= 0}
            onClick={() => inputRef.current?.click()}
          >
            <Images className="size-4" aria-hidden />
            {t("gallery.addPhotos")}
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDropActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDropActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDropActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDropActive(false);
            if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
          }}
          className={cn(
            "mb-4 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors",
            dropActive
              ? "border-[var(--dalily-gold)] bg-[var(--dalily-gold)]/10"
              : "border-border/80 bg-muted/20",
          )}
        >
          <p className="text-sm font-medium text-foreground">{t("gallery.dropHint")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("gallery.dropHintSecondary")}</p>
        </div>

        {sortedItems.length === 0 && uploads.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-10 text-center">
            <Images className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              {t("gallery.empty")}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sortedItems.map((image) => (
              <li
                key={image.id}
                draggable
                onDragStart={() => onDragStart(image.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  onDragOver(image.id);
                }}
                onDragEnd={onDragEnd}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-2xl border bg-muted",
                  draggingId === image.id && "opacity-60",
                  image.isFeatured && "ring-2 ring-[var(--dalily-gold)]",
                )}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  loading="lazy"
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
                <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-2">
                  <span className="inline-flex items-center rounded-md bg-black/55 px-1.5 py-1 text-white">
                    <GripVertical className="size-3.5" aria-hidden />
                    <span className="sr-only">{t("gallery.dragHandle")}</span>
                  </span>
                  {image.isFeatured ? (
                    <span className="rounded-md bg-[var(--dalily-gold)] px-1.5 py-0.5 text-[0.65rem] font-bold text-[var(--dalily-navy)]">
                      {t("gallery.featured")}
                    </span>
                  ) : null}
                </div>
                <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 flex-1 gap-1 px-2 text-xs"
                    disabled={busy || image.isFeatured}
                    onClick={() => setFeatured(image.id)}
                  >
                    <Star className="size-3.5" aria-hidden />
                    {t("gallery.setFeatured")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-8 px-2"
                    disabled={busy}
                    onClick={() => removeImage(image.id)}
                    aria-label={t("actions.delete")}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}

            {uploads.map((upload) => (
              <li
                key={upload.id}
                className="relative aspect-square overflow-hidden rounded-2xl border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={upload.previewUrl} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex flex-col justify-end bg-black/45 p-2">
                  <p className="truncate text-xs text-white">{upload.name}</p>
                  <Progress value={upload.progress} className="mt-1 h-1.5" />
                  {upload.status === "error" ? (
                    <p className="mt-1 text-[0.65rem] text-red-200">{upload.error}</p>
                  ) : (
                    <p className="mt-1 text-[0.65rem] text-white/80">
                      {upload.status === "compressing"
                        ? t("gallery.compressing")
                        : t("uploading")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
