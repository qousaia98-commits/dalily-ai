import { requireAuthUser } from "@/lib/auth/session";
import { ContactSupportForm } from "@/components/account/contact-support-form";

export default async function AccountSupportPage() {
  await requireAuthUser();

  return (
    <div className="mx-auto flex w-full max-w-lg justify-center px-4 py-10 sm:px-6">
      <ContactSupportForm />
    </div>
  );
}
