import { cookies } from "next/headers";
import {
  hasLocationPreferenceSet,
  LOC_PREF_COOKIE,
} from "@/lib/geo/location-preference";
import { LocationOnboardingModal } from "./location-onboarding-modal";

export async function LocationOnboardingHost() {
  const jar = await cookies();
  const shouldShow = !hasLocationPreferenceSet(jar.get(LOC_PREF_COOKIE)?.value);

  return <LocationOnboardingModal shouldShow={shouldShow} />;
}
