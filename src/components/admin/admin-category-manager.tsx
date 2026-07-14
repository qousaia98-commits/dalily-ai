"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import {
  createCategoryAction,
  toggleCategoryActiveAction,
  updateCategoryAction,
} from "@/actions/admin-category.actions";
import { CategoryIcon } from "@/components/categories/category-icon";
import { localizedField } from "@/lib/categories/format";
import type { CategoryRecord } from "@/lib/categories/types";
import type { Locale } from "@/lib/i18n/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type AdminCategoryManagerProps = {
  categories: CategoryRecord[];
};

type EditorState = {
  id?: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  icon: string;
  sortOrder: number;
  parentId: string | null;
  depth: number;
  isActive: boolean;
};

const emptyEditor = (): EditorState => ({
  slug: "",
  nameAr: "",
  nameEn: "",
  descriptionAr: "",
  descriptionEn: "",
  icon: "circle",
  sortOrder: 0,
  parentId: null,
  depth: 1,
  isActive: true,
});

export function AdminCategoryManager({ categories }: AdminCategoryManagerProps) {
  const t = useTranslations("admin.categories");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const groups = useMemo(
    () => categories.filter((category) => category.depth === 0),
    [categories],
  );

  const sorted = useMemo(
    () =>
      [...categories].sort((a, b) =>
        a.depth === b.depth ? a.sort_order - b.sort_order : a.depth - b.depth,
      ),
    [categories],
  );

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.success ? t("saved") : t(`errors.${result.error ?? "update_failed"}`));
      if (result.success) {
        setEditor(null);
        router.refresh();
      }
    });
  }

  function openCreate(depth: 0 | 1) {
    setEditor({
      ...emptyEditor(),
      depth,
      parentId: depth === 1 && groups[0] ? groups[0].id : null,
      sortOrder: categories.filter((c) => c.depth === depth).length + 1,
    });
  }

  function openEdit(category: CategoryRecord) {
    setEditor({
      id: category.id,
      slug: category.slug,
      nameAr: category.name.ar,
      nameEn: category.name.en,
      descriptionAr: category.description?.ar ?? "",
      descriptionEn: category.description?.en ?? "",
      icon: category.icon ?? "circle",
      sortOrder: category.sort_order,
      parentId: category.parent_id,
      depth: category.depth,
      isActive: category.is_active,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => openCreate(0)} className="gap-2">
          <Plus className="size-4" />
          {t("createGroup")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => openCreate(1)} className="gap-2">
          <Plus className="size-4" />
          {t("createCategory")}
        </Button>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {editor ? (
        <Card>
          <CardHeader>
            <CardTitle>{editor.id ? t("editTitle") : t("createTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              action={(formData) => {
                run(() =>
                  editor.id ? updateCategoryAction(formData) : createCategoryAction(formData),
                );
              }}
            >
              {editor.id ? <input type="hidden" name="id" value={editor.id} /> : null}
              <input type="hidden" name="depth" value={editor.depth} />
              <input type="hidden" name="isActive" value={String(editor.isActive)} />

              <div className="space-y-2">
                <Label htmlFor="slug">{t("fields.slug")}</Label>
                <Input
                  id="slug"
                  name="slug"
                  value={editor.slug}
                  onChange={(e) => setEditor({ ...editor, slug: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon">{t("fields.icon")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="icon"
                    name="icon"
                    value={editor.icon}
                    onChange={(e) => setEditor({ ...editor, icon: e.target.value })}
                    required
                  />
                  <div className="flex size-10 items-center justify-center rounded-md border">
                    <CategoryIcon name={editor.icon} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameEn">{t("fields.nameEn")}</Label>
                <Input
                  id="nameEn"
                  name="nameEn"
                  value={editor.nameEn}
                  onChange={(e) => setEditor({ ...editor, nameEn: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameAr">{t("fields.nameAr")}</Label>
                <Input
                  id="nameAr"
                  name="nameAr"
                  value={editor.nameAr}
                  onChange={(e) => setEditor({ ...editor, nameAr: e.target.value })}
                  dir="rtl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descriptionEn">{t("fields.descriptionEn")}</Label>
                <Textarea
                  id="descriptionEn"
                  name="descriptionEn"
                  value={editor.descriptionEn}
                  onChange={(e) => setEditor({ ...editor, descriptionEn: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descriptionAr">{t("fields.descriptionAr")}</Label>
                <Textarea
                  id="descriptionAr"
                  name="descriptionAr"
                  value={editor.descriptionAr}
                  onChange={(e) => setEditor({ ...editor, descriptionAr: e.target.value })}
                  dir="rtl"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">{t("fields.sortOrder")}</Label>
                <Input
                  id="sortOrder"
                  name="sortOrder"
                  type="number"
                  value={editor.sortOrder}
                  onChange={(e) =>
                    setEditor({ ...editor, sortOrder: Number(e.target.value) || 0 })
                  }
                  required
                />
              </div>
              {editor.depth === 1 ? (
                <div className="space-y-2">
                  <Label>{t("fields.group")}</Label>
                  <Select
                    value={editor.parentId ?? ""}
                    onValueChange={(value) => setEditor({ ...editor, parentId: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {localizedField(group.name, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="parentId" value={editor.parentId ?? ""} />
                </div>
              ) : (
                <input type="hidden" name="parentId" value="" />
              )}

              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" disabled={pending} className="gap-2">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t("save")}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                  {t("cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {sorted.map((category) => (
          <Card key={category.id}>
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <CategoryIcon name={category.icon} />
                </div>
                <div>
                  <p className="font-medium">
                    {localizedField(category.name, locale)}
                    <span className="ms-2 text-xs text-muted-foreground">({category.slug})</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {category.depth === 0 ? t("groupLabel") : t("categoryLabel")} ·{" "}
                    {t("order", { value: category.sort_order })}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={category.is_active ? "success" : "secondary"}>
                  {category.is_active ? t("active") : t("inactive")}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => openEdit(category)} className="gap-1">
                  <Pencil className="size-3.5" />
                  {t("edit")}
                </Button>
                <Button
                  size="sm"
                  variant={category.is_active ? "destructive" : "default"}
                  disabled={pending}
                  onClick={() =>
                    run(() => toggleCategoryActiveAction(category.id, !category.is_active))
                  }
                >
                  {category.is_active ? t("disable") : t("enable")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
