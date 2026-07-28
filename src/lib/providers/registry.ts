/**
 * Provider registry — known providers and implementation status.
 * Runtime still uses OpenAI / Supabase only; other IDs are reserved.
 */

import type { ProviderKind } from "./interfaces";

export type ProviderRegistration = {
  kind: ProviderKind;
  id: string;
  /** When false, resolver maps to the default implementation. */
  implemented: boolean;
};

export const PROVIDER_REGISTRY: readonly ProviderRegistration[] = [
  { kind: "vision", id: "openai", implemented: true },
  { kind: "vision", id: "azure_openai", implemented: false },
  { kind: "vision", id: "anthropic", implemented: false },
  { kind: "vision", id: "gemini", implemented: false },
  { kind: "vision", id: "local", implemented: false },
  { kind: "ocr", id: "openai", implemented: true },
  { kind: "whisper", id: "openai", implemented: true },
  { kind: "whisper", id: "azure_openai", implemented: false },
  { kind: "whisper", id: "local", implemented: false },
  { kind: "speech", id: "openai", implemented: true },
  { kind: "forecast", id: "openai", implemented: true },
  { kind: "forecast", id: "local", implemented: false },
  { kind: "chat", id: "supabase", implemented: true },
  { kind: "chat", id: "local", implemented: false },
  { kind: "messaging", id: "supabase", implemented: true },
] as const;

export function isProviderImplemented(kind: ProviderKind, id: string): boolean {
  return PROVIDER_REGISTRY.some(
    (p) => p.kind === kind && p.id === id && p.implemented,
  );
}
