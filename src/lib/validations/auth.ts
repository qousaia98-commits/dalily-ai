import { z } from "zod";
import { CITY_IDS } from "@/lib/constants/reference-data";

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: z.string().min(6).max(128),
  locale: z.enum(["ar", "en"]).default("ar"),
});

export const registerBusinessSchema = z
  .object({
    businessName: z.string().trim().min(2).max(120),
    category: z.string().trim().min(1).max(80),
    city: z.enum(Object.keys(CITY_IDS) as [string, ...string[]]),
    phone: z.string().trim().min(7).max(20),
    email: z.string().trim().email(),
    password: z.string().min(6).max(128),
    confirmPassword: z.string().min(6).max(128),
    about: z.string().trim().min(10).max(2000),
    services: z.string().trim().max(2000).optional(),
    locale: z.enum(["ar", "en"]).default("ar"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "password_mismatch",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterBusinessInput = z.infer<typeof registerBusinessSchema>;
