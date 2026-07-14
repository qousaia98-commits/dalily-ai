import { z } from "zod";
import { CITY_IDS } from "@/lib/constants/reference-data";

const localizedField = z.object({
  ar: z.string().trim().min(1).max(200),
  en: z.string().trim().min(1).max(200),
});

const localizedOptional = z.object({
  ar: z.string().trim().max(2000),
  en: z.string().trim().max(2000),
});

export const createProviderSchema = z.object({
  nameAr: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  category: z.string().trim().min(1).max(80),
  city: z.enum(Object.keys(CITY_IDS) as [string, ...string[]]),
  phone: z.string().trim().min(7).max(20),
  email: z.string().trim().email(),
  aboutAr: z.string().trim().min(10).max(2000),
  aboutEn: z.string().trim().min(10).max(2000),
});

export const updateProviderProfileSchema = z.object({
  nameAr: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  aboutAr: z.string().trim().max(2000),
  aboutEn: z.string().trim().max(2000),
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

export const serviceInputSchema = z.object({
  nameAr: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  descriptionAr: z.string().trim().max(500).optional().or(z.literal("")),
  descriptionEn: z.string().trim().max(500).optional().or(z.literal("")),
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

export const imageUploadSchema = z.object({
  providerId: z.string().uuid(),
  kind: z.enum(["avatar", "cover", "gallery"]),
});

export { localizedField, localizedOptional };
