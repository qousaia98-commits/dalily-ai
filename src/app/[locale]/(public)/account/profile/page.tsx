import { requireAuthUser } from "@/lib/auth/session";
import { EditProfileForm } from "@/components/account/edit-profile-form";

export default async function AccountProfilePage() {
  const authUser = await requireAuthUser();

  return (
    <div className="mx-auto flex w-full max-w-lg justify-center px-4 py-10 sm:px-6">
      <EditProfileForm
        initialDisplayName={authUser.displayName ?? ""}
        initialEmail={authUser.email}
      />
    </div>
  );
}
