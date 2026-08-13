# Environment aliases (generated)

> Source of truth: `src/lib/config/environment/aliases.ts`
> Regenerate: `node scripts/generate-env-alias-docs.mjs`

| Canonical | Aliases (deprecated/accepted) | Category | Notes |
| --- | --- | --- | --- |
| `OCR_PROVIDER` | `VISION_PROVIDER` | providers | Vision / OCR provider id; unimplemented IDs map to openai |
| `WHISPER_PROVIDER` | `SPEECH_PROVIDER`, `STT_PROVIDER` | providers |  |
| `FORECAST_PROVIDER` | `PREDICTION_PROVIDER` | providers |  |
| `CHAT_PROVIDER` | `MESSAGING_PROVIDER` | providers |  |
| `CHAT_ENGINE` | `CHAT_AUTH_V2` | marketplace | CHAT_AUTH_V2 remains accepted |
| `MESSAGING_ENGINE` | — | marketplace | Cascades to CHAT_ENGINE when unset |
| `REALTIME_ENGINE` | `REALTIME_CHAT`, `REALTIME_CHAT_V1` | marketplace |  |
| `VISION_ENGINE` | `AI_ENGINE_V5` | ai | Also cascades via AI_ENGINE_V5+ ladder |
| `SPEECH_ENGINE` | `AI_ENGINE_V6` | ai |  |
| `FORECAST_ENGINE` | `AI_DEMAND_FORECASTING`, `AI_DEMAND_FORECASTING_V1`, `DEMAND_FORECASTING` | ai |  |
| `PREDICTIVE_ENGINE` | `AI_ENGINE_V8` | ai |  |
| `SMART_MATCHING_ENGINE` | `SMART_MATCHING_ENGINE_V1`, `AI_SMART_MATCHING` | ai | Aliases deprecated but still OR'd at runtime |
| `PROVIDER_MONETIZATION` | `PROVIDER_MONETIZATION_V1`, `LEAD_MONETIZATION_V1` | payments |  |
| `PAYMENT_INFRASTRUCTURE` | `PAYMENT_INFRASTRUCTURE_V1` | payments |  |
| `FINANCIAL_DOCUMENTS` | `FINANCIAL_DOCUMENTS_V1` | payments |  |
| `REFUNDS_DISPUTES` | `REFUNDS_DISPUTES_V1` | payments |  |
| `FINANCE_DASHBOARD` | `FINANCE_DASHBOARD_V1` | payments |  |
| `REVIEWS_REPUTATION_V2` | `REVIEWS_REPUTATION`, `AI_REPUTATION_V1` | ai |  |
| `AI_REPUTATION_ENGINE` | `AI_REPUTATION_ENGINE_V1` | ai |  |
| `QUALITY_CASES` | `QUALITY_CASES_V1`, `QA_CASE_MANAGEMENT` | ai |  |
| `FRAUD_DETECTION` | `FRAUD_DETECTION_V1`, `RISK_INTELLIGENCE` | ai |  |
| `AI_OPS` | `AI_OPS_V1`, `PLATFORM_HEALTH`, `AI_OPERATIONS` | ai |  |
| `AI_DYNAMIC_PRICING` | `AI_DYNAMIC_PRICING_V1`, `DYNAMIC_PRICING` | ai |  |
| `AI_SCHEDULING` | `AI_SCHEDULING_V1`, `AI_CAPACITY_OPTIMIZATION` | ai |  |
| `AI_BUSINESS_ASSISTANT` | `AI_BUSINESS_ASSISTANT_V1`, `BUSINESS_ASSISTANT` | ai |  |
| `AI_MARKETPLACE_INTELLIGENCE` | `AI_MARKETPLACE_INTELLIGENCE_V1`, `MARKETPLACE_INTELLIGENCE` | ai |  |
| `OPENAI_API_KEY` | `SEARCH_LLM_API_KEY`, `CHAT_AI_API_KEY` | providers | Shared OpenAI key aliases used by search/chat helpers |
