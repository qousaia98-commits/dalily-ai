"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loginSchema,
  registerSchema,
  registerBusinessSchema,
} from "@/lib/validations/auth";
import { generateProviderSlug, localizedName, mapAuthErrorCode } from "@/lib/auth/utils";
import { getPostLoginPath } from "@/lib/auth/roles";
import {
  CATEGORY_IDS,
  CITY_IDS,
  MODULE_SERVICES_ID,
} from "@/lib/constants/reference-data";
import type { AppRole } from "@/types/database.types";

export type AuthActionState = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
  redirectTo?: string;
};

async function createUserRecords(params: {
  userId: string;
  email: string;
  displayName: string;
  role: AppRole;
  locale: string;
  useAdmin: boolean;
}) {
  const client = params.useAdmin ? createAdminClient() : await createClient();

  const { error: userError } = await client.from("users").insert({
    id: params.userId,
    email: params.email,
    preferred_locale: params.locale,
    email_verified_at: params.useAdmin ? null : new Date().toISOString(),
  });

  if (userError) throw userError;

  const { error: profileError } = await client.from("profiles").insert({
    user_id: params.userId,
    display_name: params.displayName,
  });

  if (profileError) throw profileError;

  const { error: roleError } = await client.from("user_roles").insert({
    user_id: params.userId,
    role: params.role,
  });

  if (roleError) throw roleError;
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      error: "validation_error",
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      success: false,
      error: mapAuthErrorCode(error.message),
    };
  }

  if (!data.user) {
    return { success: false, error: "unknown" };
  }

  await supabase
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  const rolesResult = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .is("revoked_at", null);

  const roles = (rolesResult.data ?? []).map((r) => r.role as AppRole);
  const redirectTo = getPostLoginPath(roles);

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = (formData.get("locale") as string) || "ar";

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    locale,
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      error: "validation_error",
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.name,
        role: "user",
      },
    },
  });

  if (error) {
    return { success: false, error: mapAuthErrorCode(error.message) };
  }

  if (!data.user) {
    return { success: false, error: "unknown" };
  }

  const hasSession = Boolean(data.session);

  try {
    await createUserRecords({
      userId: data.user.id,
      email: parsed.data.email,
      displayName: parsed.data.name,
      role: "user",
      locale: parsed.data.locale,
      useAdmin: !hasSession,
    });
  } catch {
    return { success: false, error: "profile_creation_failed" };
  }

  revalidatePath("/", "layout");

  if (!hasSession) {
    return {
      success: true,
      message: "verify_email",
    };
  }

  redirect("/");
}

export async function registerBusinessAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = (formData.get("locale") as string) || "ar";

  const parsed = registerBusinessSchema.safeParse({
    businessName: formData.get("businessName"),
    category: formData.get("category"),
    city: formData.get("city"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    about: formData.get("about"),
    services: formData.get("services") || undefined,
    locale,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    const formErrors = parsed.error.flatten().formErrors;

    return {
      success: false,
      fieldErrors,
      error: formErrors[0] === "password_mismatch" ? "password_mismatch" : "validation_error",
    };
  }

  const categoryId = CATEGORY_IDS[parsed.data.category];
  const cityId = CITY_IDS[parsed.data.city];

  if (!categoryId || !cityId) {
    return { success: false, error: "validation_error" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.businessName,
        role: "business",
      },
    },
  });

  if (error) {
    return { success: false, error: mapAuthErrorCode(error.message) };
  }

  if (!data.user) {
    return { success: false, error: "unknown" };
  }

  const hasSession = Boolean(data.session);
  const admin = hasSession ? await createClient() : createAdminClient();

  try {
    await createUserRecords({
      userId: data.user.id,
      email: parsed.data.email,
      displayName: parsed.data.businessName,
      role: "business",
      locale: parsed.data.locale,
      useAdmin: !hasSession,
    });

    const slug = generateProviderSlug(parsed.data.businessName, data.user.id);
    const about = localizedName(parsed.data.about);

    const { error: providerError } = await admin.from("providers").insert({
      owner_id: data.user.id,
      slug,
      name: localizedName(parsed.data.businessName),
      about,
      module_id: MODULE_SERVICES_ID,
      category_id: categoryId,
      city_id: cityId,
      phone: parsed.data.phone,
      whatsapp: parsed.data.phone,
      email: parsed.data.email,
      status: "draft",
      verification_status: "unverified",
      profile_completeness: 40,
      created_by: data.user.id,
      updated_by: data.user.id,
      metadata: {
        services_text: parsed.data.services ?? "",
      },
    });

    if (providerError) throw providerError;
  } catch {
    return { success: false, error: "profile_creation_failed" };
  }

  revalidatePath("/", "layout");

  if (!hasSession) {
    return {
      success: true,
      message: "verify_email_business",
    };
  }

  redirect("/business");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");

  const locale = await getLocale();
  redirect(locale === "ar" ? "/" : "/en");
}
