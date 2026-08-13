import { z } from "zod";
import { CITY_IDS } from "@/lib/constants/reference-data";
import { emailField, phoneField } from "@/lib/validations/common";

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6).max(128),
    confirmPassword: z.string().min(6).max(128),
    /** Required when changing password from a normal (non-recovery) session. */
    currentPassword: z.string().min(1).max(128).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "password_mismatch",
    path: ["confirmPassword"],
  });

/** Change password while already logged in (requires current password). */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    password: z.string().min(6).max(128),
    confirmPassword: z.string().min(6).max(128),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "password_mismatch",
    path: ["confirmPassword"],
  });

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailField,
  password: z.string().min(6).max(128),
  locale: z.enum(["ar", "en"]).default("ar"),
});

export const registerBusinessSchema = z
  .object({
    businessName: z.string().trim().min(2).max(120),
    category: z.string().trim().min(1).max(80),
    city: z.enum(Object.keys(CITY_IDS) as [string, ...string[]]),
    phone: phoneField,
    email: emailField,
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
