# Legacy Inventory (Sprint 0)

Modules below are **LEGACY** relative to Dalily 2.0.  
They remain functional until later sprints strangle/remove them.

Each listed path must contain a `LEGACY.md` marker file.

## Product-path legacy (retire or rewrite)

| Path | Reason | Target fate |
| --- | --- | --- |
| `src/lib/subscription/` | Pay-for-visibility / plan ranking benefits | Delete product path (Sprint 10) |
| `src/lib/search/` (browse/engine ranking host) | Directory discovery primary | Rewrite customer spine; salvage AI pieces |
| `src/lib/search/smart-match/` | Useful ideas, wrong host problem | Salvage into Matching (Sprint 3) |
| `src/lib/dalily-ranking/` | Directory score / blend for browse | Rewrite/remove from request allocation |
| `src/lib/smart-map/` | Directory map UX | Remove from customer core |
| `src/lib/service-requests/` (accept→chat machine) | Wrong contact economics | Rewrite Marketplace lifecycle |
| `src/lib/booking/` (heavy scheduling) | Heavier than PSD job checkpoints | Shrink / demote |
| `src/app/[locale]/(public)/search/` | Directory UI | Replace as primary (Sprint 2/10) |
| `src/app/[locale]/(public)/providers/` | Public browse profiles | Delete browse path |
| `src/app/[locale]/(business)/business/subscription/` | Subscription monetization UI | Delete path |

## Removed in Sprint 10A (LOW risk only)

| Path | Notes |
| --- | --- |
| `src/lib/mock/` | Empty stub; no imports |
| `src/app/[locale]/(public)/favorites/` | Orphan product stub |
| `src/app/[locale]/(business)/business/gallery/` | Redirect-only alias → `/business/media` |
| `src/components/search/` | Directory + long diagnosis UX | Rewrite/salvage intake widgets |
| `src/components/business/subscription-*` | Subscription UI | Delete |

## Schema truth

- **Source of truth:** `supabase/migrations/*`
- **Not source of truth:** root `schema.sql` (see header note)

## Rule

Do not add new features to LEGACY modules. Safety bugfixes only.
