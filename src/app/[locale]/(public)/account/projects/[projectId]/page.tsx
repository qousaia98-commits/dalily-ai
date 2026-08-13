import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { isMultiServiceProjectsEnabled } from "@/lib/config/feature-flags";
import { getProjectDashboard } from "@/lib/projects";
import { ProjectDashboardPanel } from "@/components/customer/project-dashboard";
import { Link } from "@/lib/i18n/navigation";

type PageProps = {
  params: Promise<{ projectId: string; locale: string }>;
};

export default async function AccountProjectPage({ params }: PageProps) {
  if (!isMultiServiceProjectsEnabled()) {
    redirect("/account/orders");
  }

  const { projectId } = await params;
  const user = await requireAuthUser();
  const t = await getTranslations("projects.dashboard");

  const project = await getProjectDashboard(projectId);
  if (!project || project.customerId !== user.id) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/account/orders" className="text-sm text-muted-foreground underline">
        {t("back")}
      </Link>
      <ProjectDashboardPanel project={project} />
    </main>
  );
}
