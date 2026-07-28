# Sprint 9.5 Phase 3 — Vision & Speech architecture consolidation

**Scope:** Architecture only. No prompt, OCR, STT, schema, or API changes.

**Date:** 2026-07-28

## What changed

- Public APIs: `src/domains/vision` (+ `/client`), `src/domains/speech` (+ `/client`)
- Shared provider clients: `src/lib/ai/providers` (OpenAI chat + Whisper)
- Speech Engine barrel: `src/lib/speech-engine`
- Vision Engine barrel: `src/lib/vision/index.ts`
- Duplicate Whisper fetch in `voice.actions` removed (uses `speechToText`)
- Duplicate OpenAI Vision fetch wrappers unified (prompts unchanged)
- Canonical flags: `VISION_ENGINE`, `SPEECH_ENGINE`, `OCR_PROVIDER`, `WHISPER_PROVIDER`
- Docs: `docs/architecture/vision.md`, `docs/architecture/speech.md`

## Explicitly NOT changed

- Vision system prompts / JSON schemas
- Whisper model defaults per call site (search still hardcodes `whisper-1` + 15s)
- Database / migrations
- Action result shapes

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm run verify:foundation
npm run verify:mobile
```
