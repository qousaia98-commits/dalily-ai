# Vision Architecture

Sprint 9.5 Phase 3 — architecture consolidation only.  
Vision quality, OCR behaviour, prompts, and API responses are unchanged.

## Architecture

```
UI / Pages / Actions
        ↓
src/domains/vision          ← sole public entry (server)
src/domains/vision/client   ← client-safe entry
        ↓
src/lib/vision              ← Vision Engine (search / problem photo)
src/lib/ai/vision           ← AI Vision Bridge (intent intelligence)
        ↓
src/lib/ai/providers        ← shared OpenAI (future multi-provider)
        ↓
OpenAI / Future Providers
```

## Public API

**Server:**

```ts
import {
  analyzeVisionImage,
  runVisionIntelligencePipeline,
  VISION_ALLOWED_MIME,
  type VisionAnalysisPayload,
} from "@/domains/vision";
```

**Client:**

```ts
import {
  prepareVisionImage,
  revokeVisionPreview,
  type VisionLocalImage,
  type VisionPipelineDecision,
} from "@/domains/vision/client";
```

## Engine Flow (search)

1. Client compresses image (`prepareVisionImage`)
2. Action validates MIME/size
3. `analyzeVisionImage` builds prompt + calls `openaiChatCompletion`
4. Parser validates structured JSON
5. `buildVisionPipelineDecision` routes into HybridProblemDetector

## Bridge Flow (intent)

1. Flag: `isVisionEngineEnabled()` (`VISION_ENGINE` or `AI_ENGINE_V5+`)
2. `runVisionIntelligencePipeline` → analyze / cache / fusion
3. Same provider client; different prompt (Phase-5 objects/damage)

## Provider Flow

- `resolveVisionProvider()` / `OCR_PROVIDER` — currently always OpenAI path
- Future: Azure / Anthropic / Gemini / local plug into `src/lib/ai/providers`

## Feature Flags

| Canonical | Legacy aliases (still accepted) |
|-----------|----------------------------------|
| `VISION_ENGINE` | `AI_ENGINE_V5` (+ V6–V9 cascade) |
| `OCR_PROVIDER` | `VISION_PROVIDER` (default `openai`) |

## Allowed / Forbidden Imports

| From | May import |
|------|------------|
| UI / actions / pages (server) | `@/domains/vision` |
| `"use client"` UI | `@/domains/vision/client` |
| Domain adapters | `lib/vision`, `lib/ai/vision`, providers |

| From | Must not import |
|------|-----------------|
| UI / actions / pages | `@/lib/vision/**`, `@/lib/ai/vision/**`, `@/lib/ai/providers/**` |

## File classification

| Path | Class |
|------|--------|
| `domains/vision/*` | Public API |
| `lib/vision/*` | Engine |
| `lib/ai/vision/*` | Bridge |
| `lib/ai/providers/*` | Provider |
| `lib/vision/client-upload.ts` | Utility (client) |
