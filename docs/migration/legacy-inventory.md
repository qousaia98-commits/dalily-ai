# Legacy Inventory (Sprint 0)

Modules below are **LEGACY** relative to Dalily 2.0.  
They remain functional until later sprints strangle/remove them.

Each listed path must contain a `LEGACY.md` marker file.

## Product-path legacy (retire or rewrite)

| Path | Reason | Target fate |
| --- | --- | --- |
| `src/lib/subscription/` | Pay-for-visibility / plan ranking benefits | Keep until ranking/admin dependents removed |
| `src/lib/search/` (browse/engine ranking host) | Directory discovery primary | Rewrite customer spine; salvage AI pieces |
| `src/lib/search/smart-match/` | Useful ideas, wrong host problem | Salvage into Matching (Sprint 3) |
| `src/lib/dalily-ranking/` | Directory score / blend for browse | Keep for now — admin ranking inspection + provider-success Dalily Score |
| `src/lib/smart-map/` | Directory map UX | Keep for now — navigation helpers used outside search (e.g. open-route, provider-success) |
| `src/lib/service-requests/` (accept→chat machine) | Wrong contact economics | Rewrite Marketplace lifecycle |
| `src/lib/booking/` (heavy scheduling) | Heavier than PSD job checkpoints | Shrink / demote |
| `src/app/[locale]/(public)/providers/` | Public browse profiles | Keep for now — live `/providers/[id]` trust profiles still linked |
| `src/components/search/` | Directory + diagnosis UX remnants | Keep shared widgets (hero/form/category/match badges/waveform); route-only pieces removed in Sprint 10 |

## Removed in Sprint 10

| Path | Notes |
| --- | --- |
| `src/app/[locale]/(business)/business/subscription/` | Product UI removed; thin redirect → `/business` |
| `src/components/business/business-subscription-panel.tsx` | Upgrade / plan selection UI |
| `src/components/business/subscription-{hero,faq,trust,locked-state,plan-cards,upgrade-summary}.tsx` | Page-only subscription marketing UI |
| Business hub CTAs to `/business/subscription` | Payments hub, account hub, analytics upgrade CTA, growth CTA |
| `src/app/[locale]/(public)/search/` | Directory UI removed; thin redirect → `/request/new` (preserves `?q=`) |
| `src/components/search/search-results.tsx` (+ empty/error/insight/filters/nearby) | Route-only search results UI |
| `src/components/search/smart-map/*` | Search-layout map UI only (lib/smart-map kept) |

## Removed in Sprint 10A (LOW risk only)

| Path | Notes |
| --- | --- |
| `src/lib/mock/` | Empty stub; no imports |
| `src/app/[locale]/(public)/favorites/` | Orphan product stub |
| `src/app/[locale]/(business)/business/gallery/` | Redirect-only alias → `/business/media` |

## Removed in Sprint 9.5 Phase 1 (hygiene — confirmed empty / unreferenced)

| Path | Notes |
| --- | --- |
| `src/lib/mock/` | Empty directory removed |
| `src/lib/search/rule-engine/` | Empty directory removed |
| `src/app/[locale]/(public)/favorites/` | Empty directory removed |
| `src/app/[locale]/(business)/business/gallery/` | Empty directory removed |
| `src/app/[locale]/(user)/` | Only empty `.gitkeep` — removed |
| `supabase/_schema_baseline_candidate.sql` | Empty placeholder — removed |
| `mobile/types/`, `mobile/utils/` | Unused barrels — removed |
| Orphan scripts | Moved to `scripts/archive/` (see README there) |

## Schema truth

- **Source of truth:** `supabase/migrations/*`
- **Not source of truth:** root `schema.sql` (see header note)

## Rule

Do not add new features to LEGACY modules. Safety bugfixes only.
