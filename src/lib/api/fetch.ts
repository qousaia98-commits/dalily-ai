/**
 * Shared fetch with timeout (Sprint 9.5 Phase 6).
 * No automatic retries — preserves existing soft-fail call sites.
 */

import { withTimeout } from "./http";
import type { FetchJsonOptions, FetchJsonResult } from "./types";

export async function fetchWithTimeout(
  url: string,
  options: FetchJsonOptions,
): Promise<FetchJsonResult> {
  const { signal, clear } = withTimeout(options.timeoutMs, options.signal);
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal,
    });
    if (!response.ok) {
      const bodyPreview = (await response.text().catch(() => "")).slice(0, 400);
      return {
        ok: false,
        error: "http",
        status: response.status,
        bodyPreview,
      };
    }
    return { ok: true, response, status: response.status };
  } catch (error) {
    const aborted =
      (error instanceof Error && error.name === "AbortError") || signal.aborted;
    return { ok: false, error: aborted ? "aborted" : "network" };
  } finally {
    clear();
  }
}
