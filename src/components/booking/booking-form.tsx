"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarClock, Loader2, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import {
  createBookingAction,
  fetchAvailableSlotsAction,
  recordSlotSuggestionDecisionAction,
} from "@/actions/booking.actions";
import { BOOKING_DURATIONS, type TimeSlot } from "@/lib/booking/types";
import type { SmartSlotSuggestions } from "@/lib/booking/smart/types";
import { APPOINTMENT_TYPES } from "@/lib/booking/smart/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";

type ServiceOption = { id: string; name: string };

type Props = {
  providerId: string;
  services: ServiceOption[];
  isLoggedIn: boolean;
  serviceRequestId?: string | null;
  smartBookingEnabled?: boolean;
};

export function BookingForm({
  providerId,
  services,
  isLoggedIn,
  serviceRequestId,
  smartBookingEnabled = false,
}: Props) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const router = useRouter();
  const [duration, setDuration] = useState<number>(60);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [appointmentType, setAppointmentType] = useState("scheduled");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [suggestions, setSuggestions] = useState<SmartSlotSuggestions | null>(
    null,
  );
  const [selected, setSelected] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState("");
  const [locationText, setLocationText] = useState("");
  const [contact, setContact] = useState("chat");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadingSlots, startSlots] = useTransition();

  const fromDate = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    startSlots(async () => {
      const result = await fetchAvailableSlotsAction({
        providerId,
        fromDate,
        durationMinutes: duration,
        days: 14,
        appointmentType: smartBookingEnabled ? appointmentType : undefined,
      });
      if (result.success) {
        setSlots(result.slots);
        setSuggestions(result.suggestions);
        setSelected(null);
      } else {
        setSlots([]);
        setSuggestions(null);
      }
    });
  }, [providerId, fromDate, duration, appointmentType, smartBookingEnabled]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimeSlot[]>();
    for (const slot of slots) {
      const day = formatDate(slot.startsAt, locale === "ar" ? "ar" : "en", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const list = map.get(day) ?? [];
      list.push(slot);
      map.set(day, list);
    }
    return [...map.entries()];
  }, [slots, locale]);

  function pickSlot(slot: TimeSlot, fromSuggestion?: boolean) {
    setSelected(slot);
    if (smartBookingEnabled && fromSuggestion && suggestions?.recommended) {
      const isRecommended = suggestions.recommended.startsAt === slot.startsAt;
      void recordSlotSuggestionDecisionAction({
        providerId,
        startsAt: slot.startsAt,
        rank: isRecommended
          ? 1
          : suggestions.alternatives.find((a) => a.startsAt === slot.startsAt)
              ?.rank ?? null,
        decision: isRecommended ? "accepted" : "modified",
        appointmentType,
      });
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground">
        {t("loginRequired")}{" "}
        <Button asChild variant="link" className="h-auto p-0">
          <a href={`/${locale}/login?redirect=/providers/${providerId}`}>
            {t("loginCta")}
          </a>
        </Button>
      </div>
    );
  }

  return (
    <section
      className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm"
      aria-labelledby="booking-title"
    >
      <div className="flex items-center gap-2">
        <CalendarClock className="size-5 text-[var(--dalily-gold)]" aria-hidden />
        <h2 id="booking-title" className="text-lg font-bold">
          {t("formTitle")}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("formSubtitle")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {services.length ? (
          <div className="space-y-1.5">
            <Label>{t("service")}</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder={t("selectService")} />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label>{t("duration")}</Label>
          <Select
            value={String(duration)}
            onValueChange={(v) => setDuration(Number(v))}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BOOKING_DURATIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {t("minutes", { count: d })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {smartBookingEnabled ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("appointmentType")}</Label>
            <Select value={appointmentType} onValueChange={setAppointmentType}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPES.filter((x) => x !== "video").map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {smartBookingEnabled && suggestions?.recommended ? (
        <div className="space-y-2 rounded-2xl border border-[var(--dalily-gold)]/40 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,transparent)] p-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-3.5 text-[var(--dalily-gold)]" aria-hidden />
            {t("smart.recommended")}
          </p>
          <div className="flex flex-wrap gap-2">
            {[suggestions.recommended, ...suggestions.alternatives].map(
              (slot, idx) => {
                const label = formatTime(
                  slot.startsAt,
                  locale === "ar" ? "ar" : "en",
                  { hour: "2-digit", minute: "2-digit" },
                );
                const day = formatDate(
                  slot.startsAt,
                  locale === "ar" ? "ar" : "en",
                  { weekday: "short", month: "short", day: "numeric" },
                );
                const active = selected?.startsAt === slot.startsAt;
                return (
                  <Button
                    key={slot.startsAt}
                    type="button"
                    variant={active ? "default" : "outline"}
                    className={cn(
                      "min-h-11 rounded-xl",
                      idx === 0 && !active && "border-[var(--dalily-gold)]/60",
                    )}
                    onClick={() => pickSlot(slot, true)}
                  >
                    <span className="flex flex-col items-start text-start">
                      <span className="text-[0.65rem] opacity-80">
                        {idx === 0 ? t("smart.best") : t("smart.alt")} · {day}
                      </span>
                      <span>{label}</span>
                    </span>
                  </Button>
                );
              },
            )}
          </div>
          {suggestions.travelBufferMinutes > 0 ? (
            <p className="text-[0.7rem] text-muted-foreground">
              {t("smart.buffer", { minutes: suggestions.travelBufferMinutes })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>
          {smartBookingEnabled ? t("smart.moreTimes") : t("pickSlot")}
        </Label>
        {loadingSlots ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("loadingSlots")}
          </p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noSlots")}</p>
        ) : (
          <div className="max-h-64 space-y-3 overflow-y-auto pe-1">
            {grouped.map(([day, daySlots]) => (
              <div key={day} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {day}
                </p>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((slot) => {
                    const label = formatTime(
                      slot.startsAt,
                      locale === "ar" ? "ar" : "en",
                      { hour: "2-digit", minute: "2-digit" },
                    );
                    const active = selected?.startsAt === slot.startsAt;
                    return (
                      <Button
                        key={slot.startsAt}
                        type="button"
                        variant={active ? "default" : "outline"}
                        className="min-h-11 rounded-xl"
                        onClick={() => pickSlot(slot, false)}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="booking-location">{t("location")}</Label>
        <Input
          id="booking-location"
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          className="h-11 rounded-xl"
          placeholder={t("locationPlaceholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="booking-notes">{t("notes")}</Label>
        <Textarea
          id="booking-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-xl"
          placeholder={t("notesPlaceholder")}
          rows={3}
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t("contact")}</Label>
        <Select value={contact} onValueChange={setContact}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="chat">{t("contactChat")}</SelectItem>
            <SelectItem value="phone">{t("contactPhone")}</SelectItem>
            <SelectItem value="whatsapp">{t("contactWhatsapp")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {t(`errors.${error}` as "errors.create_failed")}
        </p>
      ) : null}

      <Button
        className="min-h-11 w-full rounded-xl"
        disabled={pending || !selected}
        onClick={() => {
          if (!selected) return;
          const fd = new FormData();
          fd.set("providerId", providerId);
          if (serviceId) fd.set("serviceId", serviceId);
          if (serviceRequestId) fd.set("serviceRequestId", serviceRequestId);
          fd.set("startsAt", selected.startsAt);
          fd.set("endsAt", selected.endsAt);
          fd.set("durationMinutes", String(duration));
          fd.set("locationText", locationText);
          fd.set("customerNotes", notes);
          fd.set("preferredContact", contact);
          startTransition(async () => {
            const result = await createBookingAction(fd);
            if (!result.success) {
              setError(result.error ?? "create_failed");
              return;
            }
            if (
              smartBookingEnabled &&
              suggestions?.recommended?.startsAt === selected.startsAt
            ) {
              void recordSlotSuggestionDecisionAction({
                providerId,
                startsAt: selected.startsAt,
                rank: 1,
                decision: "accepted",
                appointmentType,
                bookingId: result.bookingId,
              });
            }
            router.push(`/account/bookings/${result.bookingId}`);
          });
        }}
      >
        {pending ? t("loadingSlots") : t("submit")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t("confirmHint")}</p>
    </section>
  );
}
