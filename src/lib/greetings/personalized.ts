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

/** Capitalizes the first code point only — a no-op for scripts without case (e.g. Arabic). */
function capitalizeFirst(value: string): string {
  return value.length > 0 ? value[0]!.toUpperCase() + value.slice(1) : value;
}

/** First token of display name, else email local-part, else warm fallback. */
export function getFirstName(
  displayName: string | null | undefined,
  email?: string | null,
  locale: Locale = "ar",
): string {
  const fromName = displayName?.trim().split(/\s+/)[0];
  if (fromName && fromName.length >= 2) return capitalizeFirst(fromName);
  const fromEmail = email?.split("@")[0]?.trim();
  if (fromEmail && fromEmail.length >= 2) return capitalizeFirst(fromEmail);
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
  (n) => ({ title: `مرحباً ${n} 👋`, subtitle: "نتمنى لك يوماً موفقاً في عملك." }),
  (n) => ({ title: `أهلاً بعودتك يا ${n}`, subtitle: "إليك نظرة سريعة على يومك." }),
  (n) => ({ title: `مرحباً ${n}`, subtitle: "فرص جديدة بانتظارك — ابدأ من نظرة اليوم." }),
  (n) => ({ title: `أهلاً ${n}`, subtitle: "دليلي جاهز ليساعدك في إدارة أعمالك اليوم." }),
  (n) => ({ title: `يوم سعيد يا ${n}`, subtitle: "راجع الفرص والطلبات من مكان واحد." }),
  (n) => ({ title: `مرحباً بك ${n}`, subtitle: "لنبدأ بترتيب أولويات عملك لهذا اليوم." }),
];

const PROVIDER_EN: Array<(n: string) => Line> = [
  (n) => ({ title: `Hi ${n} 👋`, subtitle: "Wishing you a productive day with your business." }),
  (n) => ({ title: `Welcome back, ${n}`, subtitle: "Here’s a quick look at your day." }),
  (n) => ({ title: `Hello ${n}`, subtitle: "New opportunities are waiting — start with today’s overview." }),
  (n) => ({ title: `Good to see you, ${n}`, subtitle: "Dalily is ready to help you run today’s work." }),
  (n) => ({ title: `Hi ${n}`, subtitle: "Review jobs and messages from one calm home." }),
];

const ADMIN_AR: Array<(n: string) => Line> = [
  (n) => ({
    title: `مرحباً ${n} 👋`,
    subtitle: "نتمنى لك يوماً موفقاً في إدارة المنصة.",
  }),
  (n) => ({
    title: `أهلاً بعودتك يا ${n}`,
    subtitle: "إليك أهم ما يحتاج انتباهك اليوم.",
  }),
  (n) => ({
    title: `مرحباً ${n}`,
    subtitle: "مركز العمليات جاهز — ابدأ بأولويات اليوم.",
  }),
  (n) => ({
    title: `أهلاً ${n}`,
    subtitle: "يوم هادئ ومنظم يبدأ بنظرة سريعة.",
  }),
  (n) => ({
    title: `مرحباً ${n}`,
    subtitle: "راجع المهام العاجلة ثم أكمل الباقي براحة.",
  }),
];

const ADMIN_EN: Array<(n: string) => Line> = [
  (n) => ({
    title: `Hi ${n} 👋`,
    subtitle: "Wishing you a focused day running the platform.",
  }),
  (n) => ({
    title: `Welcome back, ${n}`,
    subtitle: "Here’s what needs your attention today.",
  }),
  (n) => ({
    title: `Hello ${n}`,
    subtitle: "Operations Center is ready — start with today’s priorities.",
  }),
  (n) => ({
    title: `Good to see you, ${n}`,
    subtitle: "A calm overview first, then the queues that matter.",
  }),
  (n) => ({
    title: `Hi ${n}`,
    subtitle: "Review urgent items, then handle the rest with ease.",
  }),
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
