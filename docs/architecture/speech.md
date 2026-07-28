# Speech Architecture

Sprint 9.5 Phase 3 — architecture consolidation only.  
Whisper configuration, STT behaviour, and API responses are unchanged.

## Architecture

```
UI / Pages / Actions
        ↓
src/domains/speech          ← sole public entry (server)
src/domains/speech/client   ← client-safe (recorder)
        ↓
src/lib/speech-engine       ← Speech Engine barrel
src/lib/ai/voice/*          ← engine modules + thin bridge façade
        ↓
src/lib/ai/providers        ← shared Whisper client
        ↓
OpenAI Whisper / Future Providers
```

## Public API

**Server:**

```ts
import {
  speechToText,
  runVoiceIntelligencePipeline,
  validateVoiceAudio,
  type SpeechToTextResult,
} from "@/domains/speech";
```

**Client:**

```ts
import {
  VoiceRecorder,
  VoiceRecorderError,
  MAX_RECORDING_MS,
} from "@/domains/speech/client";
```

## Engine Flow

1. Browser capture via `VoiceRecorder` (echo cancellation / noise suppression)
2. Action validates size/MIME (path-specific limits preserved)
3. `speechToText` → `openaiAudioTranscription` (Whisper)
4. Intent path: language detect → normalize → fusion → cache

## Provider Flow

- Single Whisper wrapper: `openaiAudioTranscription`
- Call sites (search voice action, intent STT, chat voice) pass their own
  `timeoutMs` / `model` so behaviour stays identical
- `WHISPER_PROVIDER` reserved for future multi-provider routing

## Feature Flags

| Canonical | Legacy aliases |
|-----------|----------------|
| `SPEECH_ENGINE` | `AI_ENGINE_V6` (+ V7–V9 cascade) |
| `WHISPER_PROVIDER` | `SPEECH_PROVIDER`, `STT_PROVIDER` (default `openai`) |
| `CHAT_VOICE_MESSAGING` | chat voice notes (unchanged) |

## Allowed / Forbidden Imports

| From | May import |
|------|------------|
| UI / actions / pages (server) | `@/domains/speech` |
| `"use client"` UI | `@/domains/speech/client` |
| Domain / speech-engine | `lib/ai/voice/*`, providers |

| From | Must not import |
|------|-----------------|
| UI / actions / pages | `@/lib/ai/voice/**`, `@/lib/speech-engine/**`, `@/lib/ai/providers/**`, deep Whisper URLs |

## Legacy adapters

- Search voice action previously inlined Whisper fetch — now uses `speechToText`
  with the same 15s timeout and `whisper-1` model.
- `src/lib/ai/voice` modules remain the implementation host; `speech-engine` is the
  canonical engine barrel.

## File classification

| Path | Class |
|------|--------|
| `domains/speech/*` | Public API |
| `lib/speech-engine` | Engine barrel |
| `lib/ai/voice/*` | Engine modules + Bridge façade |
| `lib/ai/providers/openai-whisper.ts` | Provider |
| `lib/voice/recorder.ts` | Utility (client) |
