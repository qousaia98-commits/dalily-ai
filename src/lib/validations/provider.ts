import { z } from "zod";
import { CITY_IDS } from "@/lib/constants/reference-data";
import { locales } from "@/lib/i18n/config";

const localeField = z.enum(locales);

const localizedField = z.object({
  ar: z.string().trim().min(1).max(200),
  en: z.string().trim().min(1).max(200),
});

const localizedOptional = z.object({
  ar: z.string().trim().max(2000),
  en: z.string().trim().max(2000),
});

export const createProviderSchema = z.object({
  locale: localeField,
  businessName: z.string().trim().min(2).max(120),
  category: z.string().trim().min(1).max(80),
  city: z.enum(Object.keys(CITY_IDS) as [string, ...string[]]),
  phone: z.string().trim().min(7).max(20),
  email: z.string().trim().email(),
  about: z.string().trim().min(10).max(2000),
});

export const updateProviderProfileSchema = z.object({
  locale: localeField,
  businessName: z.string().trim().min(2).max(120),
  about: z.string().trim().max(2000),
  category: z.string().trim().min(1).max(80),
  city: z.enum(Object.keys(CITY_IDS) as [string, ...string[]]),
});

export const updateContactSchema = z.object({
  phone: z.string().trim().min(7).max(20),
  whatsapp: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email(),
  website: z.union([z.literal(""), z.string().trim().url()]).optional(),
  addressAr: z.string().trim().max(500).optional().or(z.literal("")),
  addressEn: z.string().trim().max(500).optional().or(z.literal("")),
});

/** Single-step onboarding profile save (name, category, phone, about, address, city). */
export const onboardingProfileSchema = z.object({
  locale: localeField,
  businessName: z.string().trim().min(2).max(120),
  about: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(1).max(80),
  city: z.enum(Object.keys(CITY_IDS) as [string, ...string[]]),
  phone: z.string().trim().min(7).max(20),
  address: z.string().trim().min(3).max(500),
});

export const serviceInputSchema = z.object({
  locale: localeField,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateServiceSchema = serviceInputSchema.extend({
  serviceId: z.string().uuid(),
});

export const workingHoursSchema = z.object({
  hours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        isClosed: z.boolean(),
        opensAt: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
        closesAt: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
      }),
    )
    .length(7),
});

export { localizedField, localizedOptional };
