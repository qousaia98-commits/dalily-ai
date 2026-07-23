import { z } from "zod";

/** Shared field fragments reused across auth and provider validation schemas. */
export const emailField = z.string().trim().email();
export const phoneField = z.string().trim().min(7).max(20);
