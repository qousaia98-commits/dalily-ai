"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
});

export type UpdateProfileState = {
  success: boolean;
  error?: string;
  emailChangePending?: boolean;
};

export async function updateProfileAction(input: {
  displayName: string;
  email: string;
}): Promise<UpdateProfileState> {
  const authUser = await requireAuthUser();

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "validation_error" };
  }
  const { displayName, email } = parsed.data;

  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      { user_id: authUser.id, display_name: displayName },
      { onConflict: "user_id" },
    );
  if (profileError) {
    return { success: false, error: "save_failed" };
  }

  let emailChangePending = false;
  if (email !== authUser.email) {
    const { error: emailError } = await supabase.auth.updateUser({ email });
    if (emailError) {
      return { success: false, error: "email_update_failed" };
    }
    emailChangePending = true;
  }

  revalidatePath("/account");
  revalidatePath("/account/profile");
  revalidatePath("/business/account");
  return { success: true, emailChangePending };
}
