import { z } from "zod";
import {
  MAX_REQUEST_DESCRIPTION_LENGTH,
  MAX_REQUEST_TITLE_LENGTH,
} from "@/lib/service-requests/constants";

export const createServiceRequestSchema = z.object({
  providerId: z.string().uuid(),
  title: z
    .string()
    .trim()
    .min(3, "title_min")
    .max(MAX_REQUEST_TITLE_LENGTH, "title_max"),
  description: z
    .string()
    .trim()
    .min(10, "description_min")
    .max(MAX_REQUEST_DESCRIPTION_LENGTH, "description_max"),
  preferredDate: z.string().optional().or(z.literal("")),
  preferredTime: z.string().optional().or(z.literal("")),
  budget: z.string().optional().or(z.literal("")),
  locationText: z.string().trim().max(300).optional().or(z.literal("")),
});

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  bodyText: z.string().trim().min(1).max(4000),
});

export const createQuoteSchema = z.object({
  requestId: z.string().uuid(),
  price: z.coerce.number().positive().max(1_000_000_000),
  currency: z.string().trim().min(1).max(8).default("SYP"),
  estimatedDuration: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const reviewSchema = z.object({
  requestId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().or(z.literal("")),
  recommend: z.enum(["yes", "no", ""]).optional(),
  anonymous: z.enum(["true", "false", ""]).optional(),
});

export const disputeSchema = z.object({
  requestId: z.string().uuid(),
  note: z.string().trim().min(5).max(2000),
});

export const providerRequestSettingsSchema = z.object({
  acceptingRequests: z.boolean(),
  maxPendingRequests: z.coerce.number().int().min(1).max(200),
  autoRejectMessage: z.string().trim().max(500).optional().or(z.literal("")),
  vacationMode: z.boolean(),
  estimatedResponseHours: z.coerce.number().int().min(1).max(168),
});
