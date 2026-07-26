import { NextResponse } from "next/server";
import { processSmartBookingReminders } from "@/lib/booking/smart/reminders";
import { processCompletionPrompts } from "@/lib/booking/completion-service";

/**
 * Cron entry for smart booking reminders (24h / 2h / on-the-way)
 * and optional completion prompts in one pass.
 * Protect with CRON_SECRET: Authorization: Bearer <secret>
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const reminders = await processSmartBookingReminders();
  const includeCompletion =
    new URL(request.url).searchParams.get("completion") === "1";
  const completion = includeCompletion
    ? await processCompletionPrompts()
    : null;

  return NextResponse.json({ ok: true, reminders, completion });
}

export async function GET(request: Request) {
  return POST(request);
}
