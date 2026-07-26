import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isOffersV2Enabled, isEmergencyDispatchEnabled } from "@/lib/config/feature-flags";
import {
  getOpportunityDetail,
  listOfferTemplates,
  listClarifications,
} from "@/domains/offer/queries";
import { OfferComposer } from "@/components/business/offer-composer";
import { EmergencyQuickActions } from "@/components/business/emergency-quick-actions";
import { WhyMatchedReasons } from "@/components/business/why-matched-reasons";
import { JobPrepSummary } from "@/components/business/job-prep-summary";
import { VoiceRequestPreview } from "@/components/business/voice-request-preview";
import { MarkNavChannelSeen } from "@/components/shared/mark-nav-channel-seen";
import { Link } from "@/lib/i18n/routing";
import { getProviderPrepForRequest } from "@/lib/ai/jobs/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAiEngineV6Enabled } from "@/lib/config/feature-flags";

type PageProps = {
  params: Promise<{ assignmentId: string; locale: string }>;
};

export default async function BusinessOpportunityDetailPage({ params }: PageProps) {
  if (!isOffersV2Enabled()) {
    redirect("/business/requests");
  }

  const { assignmentId, locale } = await params;
  const t = await getTranslations("offerFlow.provider");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) notFound();

  const detail = await getOpportunityDetail({
    providerId: provider.id,
    assignmentId,
  });
  if (!detail) notFound();

  let categorySlug: string | null = null;
  try {
    const admin = createAdminClient();
    const { data: req } = await admin
      .from("service_requests")
      .select("category_id")
      .eq("id", detail.serviceRequestId)
      .maybeSingle();
    if (req?.category_id) {
      const { data: cat } = await admin
        .from("categories")
        .select("slug")
        .eq("id", req.category_id)
        .maybeSingle();
      categorySlug = (cat?.slug as string | undefined) ?? null;
    }
  } catch {
    categorySlug = null;
  }

  const [templates, clarifications, prep, voicePreview] = await Promise.all([
    listOfferTemplates(provider.id),
    detail.existingOfferId
      ? listClarifications(detail.existingOfferId)
      : Promise.resolve([]),
    getProviderPrepForRequest({
      serviceRequestId: detail.serviceRequestId,
      intentText: detail.intentText,
      categorySlug,
      urgency: detail.urgency,
      locale: locale === "ar" ? "ar" : "en",
    }),
    isAiEngineV6Enabled()
      ? import("@/lib/ai/voice/cache").then(({ getVoiceProviderPreview }) =>
          getVoiceProviderPreview(detail.serviceRequestId),
        )
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 animate-fade-in">
      <MarkNavChannelSeen channel="opportunities" />
      <Link href="/business/opportunities" className="text-sm text-muted-foreground underline">
        {t("back")}
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{detail.title}</h1>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.intentText}</p>
        {detail.urgency === "emergency" ? (
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {t("emergency")}
          </p>
        ) : null}
        {detail.locationText ? (
          <p className="text-sm text-muted-foreground">
            {t("area")}: {detail.locationText}
          </p>
        ) : null}
        <WhyMatchedReasons
          reasons={detail.reasons}
          aiMatchScore={detail.aiMatchScore}
          aiExplanation={detail.aiExplanation}
        />
        <p className="text-xs text-muted-foreground">{t("noAcceptRequired")}</p>
      </header>

      {isEmergencyDispatchEnabled() && detail.urgency === "emergency" ? (
        <EmergencyQuickActions
          serviceRequestId={detail.serviceRequestId}
          assignmentId={detail.assignmentId}
          locationText={detail.locationText}
        />
      ) : null}

      {voicePreview ? (
        <VoiceRequestPreview
          voice={voicePreview}
          locale={locale === "ar" ? "ar" : "en"}
        />
      ) : null}

      {prep ? <JobPrepSummary prep={prep} /> : null}

      <OfferComposer
        matchAssignmentId={detail.assignmentId}
        serviceRequestId={detail.serviceRequestId}
        templates={templates}
        existingOfferId={detail.existingOfferId}
      />

      {clarifications.length > 0 ? (
        <div className="rounded-2xl border border-border p-4">
          <p className="mb-2 text-sm font-medium">{t("clarifications")}</p>
          <ul className="space-y-2 text-sm">
            {clarifications.map((c) => (
              <li key={c.id}>
                <span className="font-medium">{c.authorRole}:</span> {c.body}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
