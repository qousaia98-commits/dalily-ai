# Modularization (Sprint 9.5 Phase 7)

Maintainability-only splits. **No behaviour / API / schema / auth changes.**

## Files split

| Before | After | Reason |
| --- | --- | --- |
| `src/actions/service-request.actions.ts` (~1075 LOC) | `src/actions/service-request/*` + thin barrel | One responsibility per action group |
| `src/components/customer/intent-intake-flow.tsx` (~952 LOC) | `src/components/customer/intent-intake-flow/*` + shim | Steps / hooks / types separation |

Public import paths unchanged:

- `@/actions/service-request.actions`
- `@/components/customer/intent-intake-flow`

## Module boundaries

### Service request actions

```
src/actions/service-request/
  types.ts          ServiceRequestActionState
  validation.ts     validationError helper
  shared.ts         revalidate + postSystemAndNotify
  queries.ts        getConversationIdForRequest
  attachments.ts    photo upload helper
  matching.ts       placeholder (matching lives in domains/matching)
  create.ts         createServiceRequestAction
  assign.ts         acceptServiceRequestAction
  cancel.ts         rejectServiceRequestAction
  update.ts         saveProviderRequestSettingsAction
  status.ts         quotes / complete / dispute / review
  notifications.ts  sendMessage + markNotificationRead
  index.ts          internal barrel
src/actions/service-request.actions.ts   stable public barrel ("use server")
```

### Intent intake flow

```
src/components/customer/intent-intake-flow/
  types.ts / constants.ts
  hooks/useIntentFlow.ts
  hooks/useIntentValidation.ts
  steps/IntentStep.tsx
  steps/ConfirmationStep.tsx
  steps/CategoryStep.tsx
  steps/DescriptionStep.tsx   # clarify UI
  steps/MediaStep.tsx         # photos + vision
  steps/LocationStep.tsx
  steps/ScheduleStep.tsx      # urgency UI (sprint name)
  steps/ReviewStep.tsx        # publish review
  IntentIntakeFlow.tsx        # orchestrator
  index.ts
src/components/customer/intent-intake-flow.tsx   re-export shim
```

## Import rules

| Rule | Detail |
| --- | --- |
| External consumers | Keep existing paths (`*.actions`, shim `.tsx`) |
| Internal modules | Prefer relative imports within the package |
| Server actions | Each exporting action file has `"use server"` |
| Action barrels | Must **not** use `"use server"` when re-exporting (Next.js rejects non-inline exports) |
| Client UI | `"use client"` on orchestrator, hooks, interactive steps |
| No cycles | Steps ↛ orchestrator; helpers ↛ action barrels |

## Public APIs

Unchanged exports from `service-request.actions`:

`ServiceRequestActionState`, `createServiceRequestAction`, `acceptServiceRequestAction`, `rejectServiceRequestAction`, `sendQuoteAction`, `acceptQuoteAction`, `declineQuoteAction`, `requestQuoteChangesAction`, `completeServiceAction`, `confirmCompletionAction`, `reportProblemAction`, `submitReviewAction`, `sendMessageAction`, `saveProviderRequestSettingsAction`, `markNotificationReadAction`.

Unchanged: `IntentIntakeFlow` props (`initialIntent`, `cities`, `loginHref`, `isAuthenticated`, `visionEnabled`, `voiceEnabled`).

## Folder conventions

1. One responsibility per file.
2. Shared types → `types.ts`; constants → `constants.ts`; validation → `validation.ts` / `useIntentValidation`.
3. Public surface via barrel / shim only.
4. Prefer composition (hooks + presentational steps) over inheritance.
5. Extract pure transforms before framework code.

## Priority 3 inventory (≥ 700 LOC)

| File | LOC | Classification | Notes |
| --- | --- | --- | --- |
| `src/types/database.types.ts` | ~6279 | **Ignore** | Generated Supabase types — never split |
| `src/actions/service-request.actions.ts` | was ~1075 | **Split** | Done (Phase 7) |
| `src/components/customer/intent-intake-flow.tsx` | was ~952 | **Split** | Done (Phase 7) |
| `src/actions/provider.actions.ts` | ~937 | **Split (future)** | Same pattern as service-request; defer to avoid auth/media risk in this sprint |
| `src/lib/finance-analytics/snapshot.ts` | ~860 | **Keep** | Cohesive report builder; split only if sections diverge |
| `src/actions/auth.actions.ts` | ~745 | **Keep** | Security-sensitive; split only with dedicated auth review |
| `src/lib/payment/stripe/webhooks.ts` | ~745 | **Keep** | Stripe event switch — keep colocated for auditability |
| `src/lib/admin/queries.ts` | ~723 | **Keep** | Query aggregation; optional future by-admin-area split |
| `src/lib/quality/service.ts` | ~716 | **Keep / watch** | Borderline; split when next quality feature lands |

## Future guidelines

1. Soft limit: aim &lt; 500 LOC for new application modules; hard review at 700+.
2. Never split generated files (`database.types.ts`, OpenAPI clients, etc.).
3. When splitting actions: shared helpers without `"use server"`; actions with `"use server"`; stable `*.actions.ts` barrel.
4. When splitting wizards: hooks own side-effects; steps own render; orchestrator owns composition.
5. Run `typecheck`, `lint`, `build`, and domain verifies after every split.
6. Document deviations from sprint naming (e.g. ScheduleStep = urgency) in this file.
