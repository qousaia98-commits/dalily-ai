import { getTranslations } from "next-intl/server";
import type { VoiceProviderPreview } from "@/domains/speech/client";

/**
 * Provider-facing voice request preview (original audio + transcript + AI summary).
 */
export async function VoiceRequestPreview({
  voice,
  locale,
}: {
  voice: VoiceProviderPreview;
  locale: "en" | "ar";
}) {
  const t = await getTranslations("offerFlow.provider.voice");
  const summary = locale === "ar" ? voice.summaryAr : voice.summaryEn;
  const transcript =
    voice.editedTranscript ||
    voice.normalizedTranscript ||
    voice.originalTranscript;

  return (
    <section
      className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-3"
      aria-label={t("title")}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("badge")}
        </p>
        <h2 className="text-sm font-semibold">{t("title")}</h2>
      </div>

      {voice.audioUrl ? (
        <audio controls preload="metadata" className="w-full">
          <source src={voice.audioUrl} />
          {t("audioUnsupported")}
        </audio>
      ) : (
        <p className="text-xs text-muted-foreground">{t("noAudio")}</p>
      )}

      <div>
        <p className="text-xs font-medium text-muted-foreground">{t("transcript")}</p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{transcript}</p>
        {voice.originalTranscript !== transcript ? (
          <p className="mt-1 text-[0.7rem] text-muted-foreground">
            {t("original")}: {voice.originalTranscript}
          </p>
        ) : null}
      </div>

      {summary ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("aiSummary")}</p>
          <p className="mt-0.5 text-sm">{summary}</p>
        </div>
      ) : null}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3 sm:block">
          <dt className="text-muted-foreground">{t("category")}</dt>
          <dd className="font-medium capitalize">
            {voice.categorySlug?.replace(/_/g, " ") ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3 sm:block">
          <dt className="text-muted-foreground">{t("urgency")}</dt>
          <dd className="font-medium capitalize">{voice.urgency ?? "—"}</dd>
        </div>
        {(voice.language || voice.dialect) && (
          <div className="flex justify-between gap-3 sm:col-span-2 sm:block">
            <dt className="text-muted-foreground">{t("language")}</dt>
            <dd className="font-medium">
              {[voice.language, voice.dialect].filter(Boolean).join(" · ")}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
