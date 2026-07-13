export const SERVICE_CATEGORIES = [
  "plumber",
  "electrician",
  "doctor",
  "lawyer",
  "mechanic",
  "cleaner",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export function isServiceCategory(value: string): value is ServiceCategory {
  return SERVICE_CATEGORIES.includes(value as ServiceCategory);
}
