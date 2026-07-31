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
| `src/lib/dalily-ranking/` | Directory score / blend for browse | Rewrite/remove from request allocation |
| `src/lib/smart-map/` | Directory map UX | Remove from customer core |
| `src/lib/service-requests/` (accept→chat machine) | Wrong contact economics | Rewrite Marketplace lifecycle |
| `src/lib/booking/` (heavy scheduling) | Heavier than PSD job checkpoints | Shrink / demote |
| `src/app/[locale]/(public)/search/` | Directory UI | Replace as primary (Sprint 2/10) |
| `src/app/[locale]/(public)/providers/` | Public browse profiles | Delete browse path |
| `src/components/search/` | Directory + long diagnosis UX | Rewrite/salvage intake widgets |

## Removed in Sprint 10

| Path | Notes |
| --- | --- |
| `src/app/[locale]/(business)/business/subscription/` | Product UI removed; thin redirect → `/business` |
| `src/components/business/business-subscription-panel.tsx` | Upgrade / plan selection UI |
| `src/components/business/subscription-{hero,faq,trust,locked-state,plan-cards,upgrade-summary}.tsx` | Page-only subscription marketing UI |
| Business hub CTAs to `/business/subscription` | Payments hub, account hub, analytics upgrade CTA, growth CTA |

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
