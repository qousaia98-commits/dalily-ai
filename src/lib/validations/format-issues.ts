import type { ZodError } from "zod";

export type ValidationIssue = {
  field: string;
  code: string;
  message: string;
};

export function zodIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "_form",
    code: issue.code,
    message: issue.message,
  }));
}

export function issuesToFieldErrors(issues: ValidationIssue[]): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.field === "_form" ? "_form" : issue.field;
    if (!fieldErrors[key]) fieldErrors[key] = [];
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}

export function exposeValidationIssues<T extends { success: false }>(
  state: T,
  issues: ValidationIssue[],
): T & { issues?: ValidationIssue[] } {
  if (process.env.NODE_ENV !== "development") return state;
  return { ...state, issues };
}
