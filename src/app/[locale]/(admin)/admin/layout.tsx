import { getLocale } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { AppHeader } from "@/components/layout/app-header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const authUser = await getAuthUser();

  if (!authUser) {
    redirect({ href: "/login", locale });
  } else if (!isAdminUser(authUser.roles)) {
    redirect({ href: "/", locale });
  } else {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    );
  }
}
