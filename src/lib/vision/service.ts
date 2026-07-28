/**
 * Vision Engine — OpenAI Vision service (search / problem photo path).
 * Returns structured JSON only (parsed + validated).
 * Images are ephemeral: base64 in the request body, never written to disk/Storage.
 *
 * HTTP transport: shared provider client (@/lib/ai/providers).
 * Prompts and parsing stay owned by this engine — do not change for architecture moves.
 */

import { VISION_REQUEST_TIMEOUT_MS } from "@/lib/vision/constants";
import { parseVisionAnalysis } from "@/lib/vision/parser";
import type { VisionAnalysisPayload } from "@/lib/vision/types";
import { openaiChatCompletion } from "@/lib/ai/providers";

function buildSystemPrompt(): string {
  return [
    "You are Dalily Vision — a local services assistant for Syria.",
    "Analyze the photo and decide if it shows a service problem a local expert can fix.",
    "Supported service categories ONLY:",
    "- electrician: broken light, damaged socket, exposed wire, burned switch, electrical panel",
    "- plumber: leaking faucet, leaking pipe, water on floor, broken sink, blocked drain",
    "- mechanic: flat tire, damaged wheel, leaking engine, battery, engine compartment",
    "- appliance_repair: washing machine leak, refrigerator, oven, dishwasher, air conditioner",
    "- locksmith: damaged lock, broken key, locked door",
    "- unsupported: landscapes, animals, food, people-only portraits, random objects, unrelated scenes",
    "",
    "Respond with ONLY a single JSON object (no markdown, no prose) using exactly these keys:",
    "{",
    '  "category": "electrician|plumber|mechanic|appliance_repair|locksmith|unsupported",',
    '  "problem": "short problem label in English",',
    '  "symptoms": ["visible symptom", "..."],',
    '  "visibleObjects": ["object", "..."],',
    '  "possibleCause": "short cause or null",',
    '  "urgency": "emergency|high|normal|low",',
    '  "emergency": false,',
    '  "confidenceLevel": "high|medium|low",',
    '  "recommendedQuestions": ["question", "..."],',
    '  "summary": "one sentence describing the service problem for search"',
    "}",
    "If the image is not a supported service problem, set category to unsupported and confidenceLevel to low.",
    "Never invent details that are not visible. Never return free-form text outside the JSON object.",
  ].join("\n");
}

export type AnalyzeVisionImageInput = {
  /** Raw image bytes */
  bytes: ArrayBuffer;
  mimeType: string;
};

export type AnalyzeVisionImageResult =
  | { success: true; analysis: VisionAnalysisPayload }
  | { success: false; error: "no_api_key" | "request_failed" | "invalid_response" };

export async function analyzeVisionImage(
  input: AnalyzeVisionImageInput,
): Promise<AnalyzeVisionImageResult> {
  const base64 = Buffer.from(input.bytes).toString("base64");
  const dataUrl = `data:${input.mimeType};base64,${base64}`;

  const completion = await openaiChatCompletion({
    timeoutMs: VISION_REQUEST_TIMEOUT_MS,
    temperature: 0,
    responseFormat: { type: "json_object" },
    logPrefix: "[vision]",
    messages: [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this photo for a local service problem and return the JSON object.",
          },
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "low" },
          },
        ],
      },
    ],
  });

  if (!completion.ok) {
    return { success: false, error: completion.error };
  }

  const analysis = parseVisionAnalysis(completion.content);
  if (!analysis) {
    console.error("[vision] failed to parse structured JSON from model");
    return { success: false, error: "invalid_response" };
  }

  return { success: true, analysis };
}
