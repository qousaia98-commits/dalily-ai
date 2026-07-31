import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  isCustomerIntentFlowV2Enabled,
  isDirectSearchV1Enabled,
} from "@/lib/config/feature-flags";

/**
 * Marketplace-native CTA: start intent intake with this provider pre-selected.
 */
export async function DirectRequestCta({
  providerId,
  acceptingRequests,
}: {
  providerId: string;
  acceptingRequests: boolean;
}) {
  if (!isDirectSearchV1Enabled() || !isCustomerIntentFlowV2Enabled()) {
    return null;
  }

  const t = await getTranslations("findFlow");

  if (!acceptingRequests) {
    return null;
  }

  return (
    <Button asChild className="w-full rounded-xl">
      <Link href={`/request/new?providerId=${encodeURIComponent(providerId)}`}>
        {t("sendRequestCta")}
      </Link>
    </Button>
  );
}
