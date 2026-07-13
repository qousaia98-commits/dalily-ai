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
  if (lower.includes("password")) return "weak_password";

  return "unknown";
}

export function randomToken(): string {
  return randomBytes(16).toString("hex");
}
