/**
 * Consistent unexpected-error handling for App Router API routes.
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/observability/logger";

/**
 * Runs an API handler and converts unexpected throws into a logged JSON 500.
 * Expected domain responses (4xx) should still be returned normally inside `fn`.
 */
export async function handleApiRoute(
  scope: string,
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    logger.error(scope, "unhandled_error", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
