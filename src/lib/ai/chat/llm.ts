/**
 * Lightweight chat-completions helper for Sprint 5 Phase 3.
 * Soft-fails (returns null) — never throws into the UI path.
 */

const TIMEOUT_MS = 8000;

export async function chatAiComplete(input: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<string | null> {
  const apiKey =
    process.env.CHAT_AI_API_KEY ??
    process.env.SEARCH_LLM_API_KEY ??
    process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const apiUrl =
    process.env.CHAT_AI_API_URL ??
    process.env.SEARCH_LLM_API_URL ??
    "https://api.openai.com/v1/chat/completions";
  const model =
    process.env.CHAT_AI_MODEL ?? process.env.SEARCH_LLM_MODEL ?? "gpt-4o-mini";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.3,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return payload.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function parseJsonObject<T extends Record<string, unknown>>(
  raw: string | null,
): T | null {
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
