import type { PostgrestError } from "@supabase/supabase-js";
import type { ValidationIssue } from "@/lib/validations/format-issues";

export type PostgresErrorDetails = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export function isPostgresError(error: unknown): error is PostgrestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as PostgrestError).message === "string"
  );
}

export function postgresErrorDetails(error: unknown): PostgresErrorDetails {
  if (isPostgresError(error)) {
    return {
      message: error.message,
      code: error.code,
      details: error.details ?? undefined,
      hint: error.hint ?? undefined,
    };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: String(error) };
}

export function isDuplicateKeyError(error: unknown): boolean {
  return isPostgresError(error) && error.code === "23505";
}

export function stepFailureIssue(step: string, error: unknown): ValidationIssue {
  const details = postgresErrorDetails(error);
  return {
    field: step,
    code: details.code ?? "db_error",
    message: details.message,
  };
}

export function logRegisterStep(step: string, ok: boolean, extra?: Record<string, unknown>) {
  const prefix = ok ? "✓" : "✗";
  if (ok) {
    console.log(`[registerBusinessAction] ${prefix} ${step}`, extra ?? "");
  } else {
    console.error(`[registerBusinessAction] ${prefix} ${step}`, extra ?? "");
  }
}
