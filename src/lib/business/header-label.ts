import type { Locale } from "@/lib/i18n/config";
import { getLocalizedField } from "@/types/provider.types";
import type { ManagedProvider } from "@/types/provider.types";

export function getBusinessHeaderLabel(
  provider: ManagedProvider | null,
  locale: Locale,
  fallback: string,
): string {
  if (!provider) return fallback;

  const name = getLocalizedField(provider.name, locale).trim();
  if (!name) return fallback;

  return name;
}
