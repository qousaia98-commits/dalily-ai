import { randomBytes } from "crypto";

export function generateProviderSlug(businessName: string, userId: string): string {
  const latinSlug = businessName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const suffix = userId.replace(/-/g, "").slice(0, 8);

  if (latinSlug.length >= 2) {
    return `${latinSlug}-${suffix}`;
  }

  return `business-${suffix}`;
}

export function localizedName(name: string): { ar: string; en: string } {
  return { ar: name, en: name };
}

export function mapAuthErrorCode(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) return "invalid_credentials";
  if (lower.includes("user already registered")) return "email_taken";
  if (lower.includes("email not confirmed")) return "email_not_confirmed";
  // Supabase surfaces signup/request throttling with messages like "email rate
  // limit exceeded", "request rate limit reached", or "you can only request
  // this after N seconds" — all previously fell through to the generic
  // "unknown" error, which is how a rate-limited signup that partially
  // succeeded (see resumeIncompleteRegistration) read to the user as an
  // unexplained failure.
  if (
    lower.includes("rate limit") ||
    lower.includes("only request this after") ||
    lower.includes("too many requests")
  ) {
    return "rate_limited";
  }
  if (lower.includes("password")) return "weak_password";

  return "unknown";
}

export function randomToken(): string {
  return randomBytes(16).toString("hex");
}
