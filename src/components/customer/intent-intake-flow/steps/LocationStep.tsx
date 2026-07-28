"use client";

import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { CityOption } from "../types";

type LocationStepProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  cities: CityOption[];
  cityId: string;
  locationText: string;
  onCityChange: (cityId: string) => void;
  onLocationTextChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function LocationStep({
  t,
  cities,
  cityId,
  locationText,
  onCityChange,
  onLocationTextChange,
  onBack,
  onContinue,
}: LocationStepProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("steps.location.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.location.subtitle")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="city">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" aria-hidden />
            {t("steps.location.city")}
          </span>
        </Label>
        <select
          id="city"
          className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={cityId}
          onChange={(e) => onCityChange(e.target.value)}
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="area">{t("steps.location.areaOptional")}</Label>
        <Textarea
          id="area"
          rows={2}
          value={locationText}
          onChange={(e) => onLocationTextChange(e.target.value)}
          placeholder={t("steps.location.areaPlaceholder")}
          className="rounded-2xl"
        />
      </div>
      <p className="text-xs text-muted-foreground">{t("trust.addressLater")}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onBack}>
          {t("back")}
        </Button>
        <Button type="button" className="min-h-11 flex-1 rounded-xl" onClick={onContinue}>
          {t("continue")}
        </Button>
      </div>
    </section>
  );
}
