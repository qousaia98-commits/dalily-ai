/**
 * Detect Next.js Server Action version skew (stale client action IDs).
 * Happens after dev-server restarts, HMR of "use server" modules, or deploys.
 */
export function isUnrecognizedServerActionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; message?: string; digest?: string };
  if (e.name === "UnrecognizedActionError") return true;
  const msg = typeof e.message === "string" ? e.message : "";
  return (
    msg.includes("Failed to find Server Action") ||
    (msg.includes("Server Action") && msg.includes("was not found"))
  );
}

/**
 * Run a Server Action; on version skew, force a full reload so the client
 * picks up the current action IDs. Does not swallow the error.
 */
export async function runServerAction<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isUnrecognizedServerActionError(error) && typeof window !== "undefined") {
      // Full navigation — soft refresh keeps stale action closures.
      window.location.reload();
    }
    throw error;
  }
}
