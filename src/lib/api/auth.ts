/**
 * Auth header helpers for outbound HTTP (Sprint 9.5 Phase 6).
 */

export function bearerAuthHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

export function jsonContentHeaders(
  apiKey?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) Object.assign(headers, bearerAuthHeaders(apiKey));
  return headers;
}
