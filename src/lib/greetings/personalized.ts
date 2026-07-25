import type { AppRole } from "@/types/database.types";
import type { Locale } from "@/lib/i18n/config";
import { canAccessAdminPanel, isBusinessUser } from "@/lib/auth/roles";

export type GreetingRole = "customer" | "provider" | "admin";

export type PersonalizedGreeting = {
  role: GreetingRole;
  firstName: string;
  title: string;
  subtitle: string;
};

/** First token of display name, else email local-part, else warm fallback. */
export function getFirstName(
  displayName: string | null | undefined,
  email?: string | null,
  locale: Locale = "ar",
): string {
  const fromName = displayName?.trim().split(/\s+/)[0];
  if (fromName && fromName.length >= 2) return fromName;
  const fromEmail = email?.split("@")[0]?.trim();
  if (fromEmail && fromEmail.length >= 2) return fromEmail;
  return locale === "ar" ? "صديقي" : "there";
}

export function resolveGreetingRole(roles: AppRole[]): GreetingRole {
  if (canAccessAdminPanel(roles)) return "admin";
  if (isBusinessUser(roles)) return "provider";
  return "customer";
}

type Line = { title: string; subtitle: string };

const CUSTOMER_AR: Array<(n: string) => Line> = [
  (n) => ({ title: `مرحباً ${n} 👋`, subtitle: `كيف يمكنني مساعدتك اليوم يا ${n}؟` }),
  (n) => ({ title: `أهلاً ${n}`, subtitle: "أخبرني بما تحتاج وسأجد لك المختص المناسب." }),
  (n) => ({ title: `سعيد برؤيتك مجدداً يا ${n}`, subtitle: "ما الذي يحتاج إلى إصلاح اليوم؟" }),
  (n) => ({ title: `مرحباً ${n}`, subtitle: `أخبرني ما هي مشكلتك يا ${n}.` }),
  (n) => ({ title: `أهلاً بك يا ${n}`, subtitle: `ما الذي تريد إصلاحه اليوم يا ${n}؟` }),
  (n) => ({ title: `مرحباً ${n} 👋`, subtitle: "صف مشكلتك بكلماتك — وأنا أساعدك." }),
];

const CUSTOMER_EN: Array<(n: string) => Line> = [
  (n) => ({ title: `Hi ${n} 👋`, subtitle: `How can I help you today, ${n}?` }),
  (n) => ({ title: `Welcome back, ${n}`, subtitle: "Tell me what you need — I’ll find the right specialist." }),
  (n) => ({ title: `Good to see you, ${n}`, subtitle: "What needs fixing today?" }),
  (n) => ({ title: `Hello ${n}`, subtitle: `What’s the problem, ${n}?` }),
  (n) => ({ title: `Hey ${n}`, subtitle: "Describe it in your words — I’ll take it from there." }),
];

const PROVIDER_AR: Array<(n: string) => Line> = [
  (n) => ({ title: `مرحباً ${n}`, subtitle: "لديك اليوم فرص عمل جديدة." }),
  (n) => ({ title: `أهلاً بعودتك يا ${n}`, subtitle: "راجع الفرص والعروض من مكان واحد." }),
  (n) => ({ title: `أهلاً ${n}`, subtitle: "لنراجع طلباتك النشطة معاً." }),
  (n) => ({ title: `مرحباً ${n} 👋`, subtitle: "سوق دليلي جاهز — ابدأ من الفرص." }),
];

const PROVIDER_EN: Array<(n: string) => Line> = [
  (n) => ({ title: `Hi ${n}`, subtitle: "You have new job opportunities today." }),
  (n) => ({ title: `Welcome back, ${n}`, subtitle: "Review opportunities and offers in one place." }),
  (n) => ({ title: `Hello ${n}`, subtitle: "Let’s check your active jobs together." }),
];

const ADMIN_AR: Array<(n: string) => Line> = [
  (n) => ({ title: `مرحباً ${n}`, subtitle: "كل الأنظمة تعمل بشكل طبيعي." }),
  (n) => ({ title: `أهلاً ${n}`, subtitle: "لديك اليوم بلاغات جديدة." }),
  (n) => ({ title: `مرحباً ${n} 👋`, subtitle: "مركز التحكم جاهز للمراجعة." }),
];

const ADMIN_EN: Array<(n: string) => Line> = [
  (n) => ({ title: `Hi ${n}`, subtitle: "All systems look healthy." }),
  (n) => ({ title: `Welcome, ${n}`, subtitle: "You have new items that need attention." }),
  (n) => ({ title: `Hello ${n}`, subtitle: "Control Center is ready for review." }),
];

function pool(role: GreetingRole, locale: Locale): Array<(n: string) => Line> {
  if (role === "provider") return locale === "ar" ? PROVIDER_AR : PROVIDER_EN;
  if (role === "admin") return locale === "ar" ? ADMIN_AR : ADMIN_EN;
  return locale === "ar" ? CUSTOMER_AR : CUSTOMER_EN;
}

/** Stable pick for a given day + user (avoids flicker across soft navigations). */
export function pickGreetingIndex(seed: string, length: number): number {
  if (length <= 1) return 0;
  let hash = 0;
  const day = new Date().toISOString().slice(0, 10);
  const key = `${day}:${seed}`;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

export function buildPersonalizedGreeting(input: {
  roles: AppRole[];
  displayName?: string | null;
  email?: string | null;
  locale: Locale;
  userId?: string | null;
}): PersonalizedGreeting {
  const role = resolveGreetingRole(input.roles);
  const firstName = getFirstName(input.displayName, input.email, input.locale);
  const lines = pool(role, input.locale);
  const idx = pickGreetingIndex(input.userId ?? firstName, lines.length);
  const line = lines[idx]!(firstName);
  return { role, firstName, title: line.title, subtitle: line.subtitle };
}
