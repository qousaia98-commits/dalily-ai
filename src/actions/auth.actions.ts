"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loginSchema,
  registerSchema,
  registerBusinessSchema,
} from "@/lib/validations/auth";
import { generateProviderSlug, mapAuthErrorCode } from "@/lib/auth/utils";
import { resolveLocalizedField } from "@/lib/business/resolve-localized-fields";
import { resolveAuthUserAfterSignUp } from "@/lib/auth/resolve-signup-user";
import { getPostLoginPath } from "@/lib/auth/roles";
import { resolveCategorySlugToId } from "@/lib/categories/queries";
import { CITY_IDS, MODULE_SERVICES_ID } from "@/lib/constants/reference-data";
import {
  exposeValidationIssues,
  issuesToFieldErrors,
  zodIssues,
  type ValidationIssue,
} from "@/lib/validations/format-issues";
import type { AppRole } from "@/types/database.types";
import {
  isDuplicateKeyError,
  logRegisterStep,
  postgresErrorDetails,
  stepFailureIssue,
} from "@/lib/db/postgres-error";

export type AuthActionState = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Detailed Zod / lookup / DB issues — included in development only */
  issues?: ValidationIssue[];
  /** Failed pipeline step (development) */
  failedStep?: string;
  message?: string;
  redirectTo?: string;
};

class RegisterStepError extends Error {
  readonly step: string;
  readonly code?: string;
  readonly details?: string;
  readonly hint?: string;

  constructor(step: string, cause: unknown) {
    const details = postgresErrorDetails(cause);
    super(details.message);
    this.name = "RegisterStepError";
    this.step = step;
    this.code = details.code;
    this.details = details.details;
    this.hint = details.hint;
  }
}

async function createUserRecords(params: {
  userId: string;
  email: string;
  displayName: string;
  role: AppRole;
  locale: string;
  emailVerified: boolean;
}): Promise<void> {
  const client = createAdminClient();

  const { error: userError } = await client.from("users").insert({
    id: params.userId,
    email: params.email,
    preferred_locale: params.locale,
    email_verified_at: params.emailVerified ? new Date().toISOString() : null,
  });

  if (userError && !isDuplicateKeyError(userError)) throw new RegisterStepError("create user", userError);
  logRegisterStep(
    "create user",
    true,
    userError && isDuplicateKeyError(userError) ? { note: "already exists" } : undefined,
  );

  const { error: profileError } = await client.from("profiles").insert({
    user_id: params.userId,
    display_name: params.displayName,
  });

  if (profileError && !isDuplicateKeyError(profileError)) {
    throw new RegisterStepError("create profile", profileError);
  }
  logRegisterStep(
    "create profile",
    true,
    profileError && isDuplicateKeyError(profileError) ? { note: "already exists" } : undefined,
  );

  const { error: roleError } = await client.from("user_roles").insert({
    user_id: params.userId,
    role: params.role,
  });

  if (roleError && !isDuplicateKeyError(roleError)) throw new RegisterStepError("create role", roleError);
  logRegisterStep(
    "create role",
    true,
    roleError && isDuplicateKeyError(roleError) ? { note: "already exists" } : undefined,
  );
}

function registerBusinessStepFailure(step: string, error: unknown): AuthActionState {
  const details = postgresErrorDetails(error);
  const issue = stepFailureIssue(step, error);

  logRegisterStep(step, false, details);

  return exposeValidationIssues(
    {
      success: false,
      error:
        process.env.NODE_ENV === "development" ? details.message : "profile_creation_failed",
      failedStep: process.env.NODE_ENV === "development" ? step : undefined,
      fieldErrors: { [step]: [details.message] },
    },
    [issue],
  );
}

function registerBusinessCaughtFailure(error: unknown): AuthActionState {
  if (error instanceof RegisterStepError) {
    return registerBusinessStepFailure(error.step, error);
  }
  return registerBusinessStepFailure("unknown", error);
}

/** Post-signUp bootstrap — always uses service role (RLS-safe in server actions). */
async function bootstrapUserAfterSignUp(params: {
  userId: string;
  email: string;
  displayName: string;
  role: AppRole;
  locale: string;
  hasSession: boolean;
}) {
  await createUserRecords({
    userId: params.userId,
    email: params.email,
    displayName: params.displayName,
    role: params.role,
    locale: params.locale,
    emailVerified: params.hasSession,
  });
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

  const { data: userRow } = await supabase
    .from("users")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (userRow?.status === "suspended" || userRow?.status === "banned") {
    await supabase.auth.signOut();
    return { success: false, error: "account_disabled" };
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
  const locale = await getLocale();

  revalidatePath("/", "layout");
  redirect({ href: redirectTo, locale });
  return { success: true };
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

  const admin = createAdminClient();
  const resolved = await resolveAuthUserAfterSignUp({
    supabase,
    admin,
    signUpUser: data.user,
    signUpSession: data.session,
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (!resolved.ok) {
    return { success: false, error: mapAuthErrorCode(resolved.error) };
  }

  const authUserId = resolved.userId;
  const hasSession = resolved.hasSession;

  try {
    await bootstrapUserAfterSignUp({
      userId: authUserId,
      email: parsed.data.email,
      displayName: parsed.data.name,
      role: "user",
      locale: parsed.data.locale,
      hasSession,
    });
  } catch (error) {
    if (error instanceof RegisterStepError) {
      return {
        success: false,
        error: "profile_creation_failed",
      };
    }
    return { success: false, error: "profile_creation_failed" };
  }

  revalidatePath("/", "layout");

  if (!hasSession) {
    return {
      success: true,
      message: "verify_email",
    };
  }

  redirect({ href: "/", locale: parsed.data.locale as "ar" | "en" });
  return { success: true };
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
    const issues = zodIssues(parsed.error);
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    const formErrors = parsed.error.flatten().formErrors;

    console.error("[registerBusinessAction] schema validation failed", {
      issues,
      fieldErrors,
      formErrors,
    });

    return exposeValidationIssues(
      {
        success: false,
        fieldErrors,
        error: formErrors[0] === "password_mismatch" ? "password_mismatch" : "validation_error",
      },
      issues,
    );
  }

  const categoryId = await resolveCategorySlugToId(parsed.data.category);
  const cityId = CITY_IDS[parsed.data.city];

  if (!categoryId || !cityId) {
    const issues: ValidationIssue[] = [];
    if (!categoryId) {
      issues.push({
        field: "category",
        code: "not_found",
        message: `Category slug "${parsed.data.category}" not found or inactive in database`,
      });
    }
    if (!cityId) {
      issues.push({
        field: "city",
        code: "not_found",
        message: `City slug "${parsed.data.city}" not found`,
      });
    }

    console.error("[registerBusinessAction] reference lookup failed", {
      issues,
      category: parsed.data.category,
      city: parsed.data.city,
    });

    return exposeValidationIssues(
      {
        success: false,
        error: "validation_error",
        fieldErrors: issuesToFieldErrors(issues),
      },
      issues,
    );
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
    logRegisterStep("signUp", false, { message: error.message });
    return { success: false, error: mapAuthErrorCode(error.message) };
  }

  if (!data.user) {
    logRegisterStep("signUp", false, { message: "no user returned" });
    return { success: false, error: "Auth signUp returned no user" };
  }

  const admin = createAdminClient();

  const resolved = await resolveAuthUserAfterSignUp({
    supabase,
    admin,
    signUpUser: data.user,
    signUpSession: data.session,
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (!resolved.ok) {
    logRegisterStep("signUp", false, { message: resolved.error });
    return { success: false, error: resolved.error };
  }

  const authUserId = resolved.userId;
  const hasSession = resolved.hasSession;

  console.log("[registerBusinessAction] INSERT will use user id", {
    authUserId,
    resumed: resolved.resumed,
    authUsersVerified: true,
  });

  try {
    await bootstrapUserAfterSignUp({
      userId: authUserId,
      email: parsed.data.email,
      displayName: parsed.data.businessName,
      role: "business",
      locale: parsed.data.locale,
      hasSession,
    });
  } catch (error) {
    return registerBusinessCaughtFailure(error);
  }

  const { data: existingProvider } = await admin
    .from("providers")
    .select("id")
    .eq("owner_id", authUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingProvider) {
    logRegisterStep("create provider", true, { note: "already exists", providerId: existingProvider.id });
  } else {
    // Translation is optional — never block registration if AI is down.
    const providerName = await resolveLocalizedField(
      parsed.data.locale,
      parsed.data.businessName,
    );
    const providerAbout = parsed.data.about
      ? await resolveLocalizedField(parsed.data.locale, parsed.data.about)
      : { ar: "", en: "" };

    const slug = generateProviderSlug(
      providerName.en || providerName.ar || parsed.data.businessName,
      authUserId,
    );

    const { error: providerError } = await admin.from("providers").insert({
      owner_id: authUserId,
      slug,
      name: providerName,
      about: providerAbout,
      module_id: MODULE_SERVICES_ID,
      category_id: categoryId,
      city_id: cityId,
      phone: parsed.data.phone,
      whatsapp: parsed.data.phone,
      email: parsed.data.email,
      status: "draft",
      verification_status: "unverified",
      profile_completeness: 40,
      created_by: authUserId,
      updated_by: authUserId,
      metadata: {
        services_text: parsed.data.services ?? "",
      },
    });

    if (providerError) {
      return registerBusinessStepFailure("create provider", providerError);
    }

    logRegisterStep("create provider", true);
  }

  logRegisterStep("success", true);

  revalidatePath("/", "layout");
  revalidatePath("/business", "layout");

  if (!hasSession) {
    return {
      success: true,
      message: "verify_email_business",
    };
  }

  redirect({ href: "/business", locale: parsed.data.locale as "ar" | "en" });
  return { success: true };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");

  const locale = await getLocale();
  redirect({ href: "/", locale });
}
