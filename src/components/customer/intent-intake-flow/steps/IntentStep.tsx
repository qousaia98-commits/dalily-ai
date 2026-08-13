"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  IntentVoiceCapture,
  type IntentVoiceInsight,
} from "@/components/customer/intent-voice-capture";

type IntentStepProps = {
  t: (key: string, values?: Record<string, string | number>) => string;
  pending: boolean;
  intentText: string;
  onIntentTextChange: (value: string) => void;
  suggestions: string[];
  voiceEnabled: boolean;
  categorySlug?: string;
  onInsight: (insight: IntentVoiceInsight | null) => void;
  onContinue: () => void;
};

export function IntentStep({
  t,
  pending,
  intentText,
  onIntentTextChange,
  suggestions,
  voiceEnabled,
  categorySlug,
  onInsight,
  onContinue,
}: IntentStepProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
      <div className="space-y-2">
        <Label htmlFor="intent" className="text-base font-semibold">
          {t("steps.intent.label")}
        </Label>
        <Textarea
          id="intent"
          value={intentText}
          onChange={(e) => onIntentTextChange(e.target.value)}
          rows={4}
          placeholder={t("steps.intent.placeholder")}
          className="min-h-28 resize-y rounded-2xl text-base focus-visible:ring-[var(--dalily-gold)]"
        />
      </div>
      <IntentVoiceCapture
        enabled={voiceEnabled}
        typedText={intentText}
        categorySlug={categorySlug}
        onInsight={onInsight}
        onTranscriptApply={(normalized) => {
          onIntentTextChange(normalized);
        }}
      />
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            className="rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs text-muted-foreground transition hover:border-[var(--dalily-gold)]/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onIntentTextChange(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <Button
        type="button"
        className="min-h-11 w-full rounded-xl"
        disabled={pending}
        onClick={onContinue}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : t("steps.intent.continue")}
      </Button>
    </section>
  );
}
