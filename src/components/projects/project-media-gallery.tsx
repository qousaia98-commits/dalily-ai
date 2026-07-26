"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import {
  listProjectGalleryAction,
  uploadProjectMediaAction,
  trackMediaEventAction,
} from "@/actions/media.actions";
import type { ProjectGalleryCategory, ProjectGalleryItem } from "@/lib/media/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CATEGORIES: ProjectGalleryCategory[] = [
  "before",
  "progress",
  "completed",
  "documents",
  "invoices",
  "certificates",
];

type Props = {
  projectId: string;
  packages?: Array<{ id: string; title: string }>;
  initialItems?: ProjectGalleryItem[];
};

export function ProjectMediaGallery({
  projectId,
  packages = [],
  initialItems = [],
}: Props) {
  const t = useTranslations("messaging.projectMedia");
  const [items, setItems] = useState(initialItems);
  const [category, setCategory] = useState<ProjectGalleryCategory | "all">("all");
  const [packageId, setPackageId] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (category !== "all" && i.galleryCategory !== category) return false;
      if (packageId && i.packageId !== packageId) return false;
      return true;
    });
  }, [items, category, packageId]);

  function refresh() {
    startTransition(async () => {
      const result = await listProjectGalleryAction({
        projectId,
        packageId: packageId || null,
        category: category === "all" ? null : category,
      });
      if (result.success) setItems(result.items);
      void trackMediaEventAction({
        event: "media_gallery_viewed",
        projectId,
      });
    });
  }

  function onFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    startTransition(async () => {
      for (const file of list) {
        const fd = new FormData();
        fd.set("projectId", projectId);
        if (packageId) fd.set("packageId", packageId);
        fd.set("category", category === "all" ? "progress" : category);
        fd.set("file", file, file.name);
        await uploadProjectMediaAction(fd);
      }
      refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{t("title")}</h2>
        <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="me-1.5 size-3.5" />
          {t("upload")}
        </Button>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={category === "all"} onClick={() => setCategory("all")}>
          {t("all")}
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {t(`categories.${c}`)}
          </Chip>
        ))}
      </div>

      {packages.length ? (
        <select
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
        >
          <option value="">{t("allPackages")}</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      ) : null}

      <div
        className={cn(
          "rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground transition",
          dragOver && "border-[var(--dalily-gold)] bg-[var(--dalily-gold)]/5",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
        }}
      >
        {t("dropHint")}
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.map((item) => (
          <li
            key={item.id}
            className={cn(
              "overflow-hidden rounded-2xl border bg-muted/30",
              item.isPinned && "ring-1 ring-[var(--dalily-gold)]",
            )}
          >
            {item.signedUrl && (item.mimeType?.startsWith("image/") || item.kind === "photo") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnailUrl || item.signedUrl}
                alt={item.displayName || item.fileName || ""}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center p-3 text-center text-xs">
                {item.displayName || item.fileName}
              </div>
            )}
            <p className="truncate px-2 py-1 text-[10px] text-muted-foreground">
              {t(`categories.${item.galleryCategory}`)}
            </p>
          </li>
        ))}
      </ul>

      {!filtered.length ? (
        <p className="text-center text-xs text-muted-foreground">{t("empty")}</p>
      ) : null}

      {pending ? (
        <p className="text-center text-xs text-muted-foreground">{t("uploading")}</p>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        multiple
        className="sr-only"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-medium",
        active
          ? "bg-[var(--dalily-navy)] text-white"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
      )}
    >
      {children}
    </button>
  );
}
