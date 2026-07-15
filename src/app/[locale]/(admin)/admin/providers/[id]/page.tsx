import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/session";
import { getProviderForAdminReview } from "@/lib/admin/queries";
import { AdminProviderReviewPanel } from "@/components/admin/admin-provider-review-panel";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminProviderReviewPage({ params }: PageProps) {
  await requireAdminUser();
  const { id } = await params;
  const provider = await getProviderForAdminReview(id);

  if (!provider) notFound();

  return (
    <div className="animate-fade-in">
      <AdminProviderReviewPanel provider={provider} />
    </div>
  );
}
