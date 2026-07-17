import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/session";
import { getProviderForAdminReview } from "@/lib/admin/queries";
import { AdminBusinessReviewWorkspace } from "@/components/admin/admin-business-review-workspace";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminProviderReviewPage({ params }: PageProps) {
  await requireAdminUser();
  const { id } = await params;
  const provider = await getProviderForAdminReview(id);

  if (!provider) notFound();

  return <AdminBusinessReviewWorkspace provider={provider} />;
}
