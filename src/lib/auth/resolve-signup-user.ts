import type { Session, User } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { logRegisterStep } from "@/lib/db/postgres-error";
import { mapAuthErrorCode } from "@/lib/auth/utils";

type AdminClient = ReturnType<typeof createAdminClient>;
type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type SignUpResolution =
  | { ok: true; userId: string; hasSession: boolean; resumed: boolean }
  | { ok: false; error: string };

export async function findAuthUserByEmail(
  admin: AdminClient,
  email: string,
): Promise<{ id: string; email?: string } | null> {
  const normalized = email.trim().toLowerCase();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;

    const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (match) return { id: match.id, email: match.email };

    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
}

export async function authUserExistsInAuthSchema(
  admin: AdminClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return false;
  return Boolean(data.user);
}

/**
 * Supabase signUp returns a fake user (empty identities) when the email is already
 * registered — that id is NOT in auth.users and will violate users_id_fkey.
 */
export async function resolveAuthUserAfterSignUp(params: {
  supabase: ServerClient;
  admin: AdminClient;
  signUpUser: User;
  signUpSession: Session | null;
  email: string;
  password: string;
}): Promise<SignUpResolution> {
  const { supabase, admin, signUpUser, signUpSession, email, password } = params;
  const identityCount = signUpUser.identities?.length ?? 0;
  const signUpUserId = signUpUser.id;

  logRegisterStep("auth.signUp result", true, {
    signUpUserId,
    identityCount,
    hasSession: Boolean(signUpSession),
    email,
  });

  if (identityCount > 0) {
    const exists = await authUserExistsInAuthSchema(admin, signUpUserId);
    logRegisterStep("auth.users contains signUp id", true, {
      userId: signUpUserId,
      exists,
    });

    if (!exists) {
      return {
        ok: false,
        error: `Auth user ${signUpUserId} not found in auth.users after signUp`,
      };
    }

    logRegisterStep("verify auth.users", true, { userId: signUpUserId });
    return {
      ok: true,
      userId: signUpUserId,
      hasSession: Boolean(signUpSession),
      resumed: false,
    };
  }

  // Empty identities — anti-enumeration placeholder; resolve the real auth.users row.
  const existing = await findAuthUserByEmail(admin, email);
  logRegisterStep("empty identities — lookup by email", true, {
    signUpUserId,
    existingAuthUserId: existing?.id ?? null,
    authUsersContainsSignUpId: await authUserExistsInAuthSchema(admin, signUpUserId),
  });

  if (!existing) {
    return { ok: false, error: "email_taken" };
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!signInError && signInData.user) {
    const exists = await authUserExistsInAuthSchema(admin, signInData.user.id);
    logRegisterStep("resumed via signIn", true, {
      userId: signInData.user.id,
      authUsersContainsId: exists,
    });
    logRegisterStep("signUp", true, {
      note: "resumed existing auth user via signIn",
      userId: signInData.user.id,
      fakeSignUpId: signUpUserId,
    });
    return {
      ok: true,
      userId: signInData.user.id,
      hasSession: Boolean(signInData.session),
      resumed: true,
    };
  }

  const notConfirmed = signInError?.message.toLowerCase().includes("not confirmed") ?? false;
  if (notConfirmed && signInError) {
    const exists = await authUserExistsInAuthSchema(admin, existing.id);
    logRegisterStep("resumed via email lookup (unconfirmed)", true, {
      userId: existing.id,
      authUsersContainsId: exists,
      signInError: signInError.message,
    });

    if (!exists) {
      return { ok: false, error: signInError.message };
    }

    logRegisterStep("signUp", true, {
      note: "resumed existing unconfirmed auth user by email",
      userId: existing.id,
      fakeSignUpId: signUpUserId,
    });
    return {
      ok: true,
      userId: existing.id,
      hasSession: false,
      resumed: true,
    };
  }

  return {
    ok: false,
    error: mapAuthErrorCode(signInError?.message ?? "email_taken"),
  };
}
