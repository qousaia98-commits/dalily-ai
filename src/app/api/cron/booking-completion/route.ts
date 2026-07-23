import { NextResponse } from "next/server";
import { processCompletionPrompts } from "@/lib/booking/completion-service";

/**
 * Cron / external scheduler entry for completion prompts.
 * Protect with CRON_SECRET header when set: Authorization: Bearer <secret>
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await processCompletionPrompts();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return POST(request);
}
