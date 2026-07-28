/**
 * Phase-5 Vision AI call — structured objects + damage + bilingual summaries.
 */

import { VISION_REQUEST_TIMEOUT_MS } from "@/lib/vision/constants";
import { openaiChatCompletion } from "@/lib/ai/providers";
import { filterHighConfidenceDamages, riskFromDamages } from "./damage";
import { filterHighConfidenceObjects } from "./objects";
import type {
  DetectedDamage,
  DetectedVisionObject,
  IntentVisionAnalysis,
} from "./types";

function buildPhase5SystemPrompt(): string {
  return [
    "You are Dalily Vision Intelligence — assist local-service providers in Syria.",
    "Analyze the photo for trade-relevant objects and visible damage.",
    "You assist providers; never invent invisible details.",
    "",
    "Object examples by trade:",
    "electrical: outlet, switch, fuse_box, lamp, cable, wire, breaker",
    "plumbing: sink, toilet, pipe, faucet, drain, boiler, valve",
    "painting: wall, ceiling, crack, mold, damaged_paint, stain",
    "",
    "Damage examples: leak, broken_pipe, rust, crack, burn_marks, water_damage,",
    "mold, missing_parts, loose_cables, blocked_drain",
    "",
    "categoryHint MUST be one of:",
    "electrician|plumber|mechanic|appliance_repair|locksmith|painting|unsupported",
    "",
    "Respond with ONLY one JSON object:",
    "{",
    '  "categoryHint": "string",',
    '  "problem": "short English label",',
    '  "symptoms": ["..."],',
    '  "objects": [{"name":"outlet","confidence":0.9,"importance":"primary","tradeHint":"electrical","boundingRegion":null}],',
    '  "damages": [{"type":"leak","confidence":0.85,"severity":"high","description":null}],',
    '  "possibleCause": "string or null",',
    '  "urgency": "emergency|high|normal|low",',
    '  "emergency": false,',
    '  "confidenceLevel": "high|medium|low",',
    '  "overallConfidence": 0.0,',
    '  "estimatedRisk": "low|medium|high",',
    '  "recommendedQuestions": ["..."],',
    '  "summaryEn": "one sentence for the customer",',
    '  "summaryAr": "جملة واحدة للعميل",',
    '  "rawVisibleObjects": ["..."]',
    "}",
    "Only include objects/damages you can see with reasonable confidence.",
    "importance: primary|secondary|context. severity: low|medium|high|critical.",
  ].join("\n");
}

function asNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

function parseObjects(raw: unknown): DetectedVisionObject[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): DetectedVisionObject | null => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const name = String(o.name ?? "").trim();
      if (!name) return null;
      const importanceRaw = String(o.importance ?? "secondary");
      const importance =
        importanceRaw === "primary" || importanceRaw === "context"
          ? importanceRaw
          : "secondary";
      let boundingRegion: DetectedVisionObject["boundingRegion"] = null;
      if (o.boundingRegion && typeof o.boundingRegion === "object") {
        const b = o.boundingRegion as Record<string, unknown>;
        boundingRegion = {
          x: asNumber(b.x),
          y: asNumber(b.y),
          w: asNumber(b.w),
          h: asNumber(b.h),
        };
      }
      return {
        name,
        confidence: asNumber(o.confidence, 0.5),
        importance,
        boundingRegion,
        tradeHint: o.tradeHint ? String(o.tradeHint) : null,
      };
    })
    .filter((x): x is DetectedVisionObject => x != null);
}

function parseDamages(raw: unknown): DetectedDamage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): DetectedDamage | null => {
      if (!item || typeof item !== "object") return null;
      const d = item as Record<string, unknown>;
      const type = String(d.type ?? "").trim();
      if (!type) return null;
      const sev = String(d.severity ?? "medium");
      const severity =
        sev === "low" || sev === "high" || sev === "critical" ? sev : "medium";
      return {
        type,
        confidence: asNumber(d.confidence, 0.5),
        severity,
        description: d.description ? String(d.description) : null,
      };
    })
    .filter((x): x is DetectedDamage => x != null);
}

export function parseIntentVisionAnalysis(
  content: string,
): IntentVisionAnalysis | null {
  try {
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const data = JSON.parse(cleaned) as Record<string, unknown>;

    const objects = filterHighConfidenceObjects(parseObjects(data.objects));
    const damages = filterHighConfidenceDamages(parseDamages(data.damages));

    // Fallback: promote rawVisibleObjects when objects empty
    const rawVisible = Array.isArray(data.rawVisibleObjects)
      ? (data.rawVisibleObjects as unknown[]).map((x) => String(x))
      : Array.isArray(data.visibleObjects)
        ? (data.visibleObjects as unknown[]).map((x) => String(x))
        : [];

    const mergedObjects =
      objects.length > 0
        ? objects
        : filterHighConfidenceObjects(
            rawVisible.map((name) => ({
              name,
              confidence: 0.6,
              importance: "secondary" as const,
              tradeHint: null,
            })),
          );

    const confidenceLevelRaw = String(data.confidenceLevel ?? "medium");
    const confidenceLevel =
      confidenceLevelRaw === "high" || confidenceLevelRaw === "low"
        ? confidenceLevelRaw
        : "medium";

    const urgencyRaw = String(data.urgency ?? "normal");
    const urgency =
      urgencyRaw === "emergency" ||
      urgencyRaw === "high" ||
      urgencyRaw === "low"
        ? urgencyRaw
        : "normal";

    let overallConfidence = asNumber(data.overallConfidence, 0);
    if (!overallConfidence) {
      overallConfidence =
        confidenceLevel === "high" ? 0.85 : confidenceLevel === "low" ? 0.35 : 0.6;
    }

    const estimatedRiskRaw = String(data.estimatedRisk ?? "");
    const estimatedRisk =
      estimatedRiskRaw === "high" || estimatedRiskRaw === "medium"
        ? estimatedRiskRaw
        : riskFromDamages(damages);

    const summaryEn =
      String(data.summaryEn ?? data.summary ?? data.problem ?? "").trim() ||
      "We reviewed your photo.";
    const summaryAr =
      String(data.summaryAr ?? "").trim() || summaryEn;

    return {
      version: 5,
      categoryHint: String(data.categoryHint ?? data.category ?? "unsupported"),
      problem: String(data.problem ?? "unknown"),
      symptoms: Array.isArray(data.symptoms)
        ? (data.symptoms as unknown[]).map((s) => String(s))
        : [],
      objects: mergedObjects,
      damages,
      possibleCause: data.possibleCause ? String(data.possibleCause) : null,
      urgency,
      emergency: Boolean(data.emergency),
      confidenceLevel,
      overallConfidence,
      estimatedRisk,
      recommendedQuestions: Array.isArray(data.recommendedQuestions)
        ? (data.recommendedQuestions as unknown[]).map((q) => String(q))
        : [],
      summaryEn,
      summaryAr,
      rawVisibleObjects: rawVisible,
    };
  } catch {
    return null;
  }
}

export type AnalyzeIntentVisionResult =
  | { success: true; analysis: IntentVisionAnalysis }
  | { success: false; error: "no_api_key" | "request_failed" | "invalid_response" };

export async function analyzeIntentVisionImage(input: {
  bytes: ArrayBuffer;
  mimeType: string;
  intentText?: string;
}): Promise<AnalyzeIntentVisionResult> {
  const base64 = Buffer.from(input.bytes).toString("base64");
  const dataUrl = `data:${input.mimeType};base64,${base64}`;

  const userText = input.intentText?.trim()
    ? `Customer description (for context only — trust the photo for visible facts):\n"${input.intentText.trim()}"\n\nAnalyze the photo and return the JSON object.`
    : "Analyze this photo for a local service problem and return the JSON object.";

  const completion = await openaiChatCompletion({
    timeoutMs: VISION_REQUEST_TIMEOUT_MS,
    temperature: 0,
    responseFormat: { type: "json_object" },
    logPrefix: "[ai.vision]",
    messages: [
      { role: "system", content: buildPhase5SystemPrompt() },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
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

  const analysis = parseIntentVisionAnalysis(completion.content);
  if (!analysis) {
    return { success: false, error: "invalid_response" };
  }
  return { success: true, analysis };
}
