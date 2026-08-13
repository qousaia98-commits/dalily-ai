import { redirect } from "next/navigation";

/**
 * Sprint 10 — legacy directory search product path retired.
 * Keep a redirect so bookmarked /search URLs do not 404.
 * Primary customer entry is now /request/new.
 */
export default async function PublicSearchRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const trimmed = q?.trim();
  if (trimmed) {
    redirect(`/request/new?q=${encodeURIComponent(trimmed)}`);
  }
  redirect("/request/new");
}
