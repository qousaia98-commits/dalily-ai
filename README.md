# Dalily AI

AI-powered platform for discovering trusted local service providers in Syria.

> **Dalily 2.0 migration (Strangler):** Product and architecture targets are documented under [`docs/migration/`](./docs/migration/README.md).  
> **Sprint 9** mobile platform is complete. **Sprint 9.5** is low-risk repository hygiene only — see [`docs/migration/sprint-9.5-cleanup-notes.md`](./docs/migration/sprint-9.5-cleanup-notes.md).  
> Do not start larger cleanup / Sprint 10 without explicit approval.

## Stack

- Next.js 15 · TypeScript · Tailwind CSS v4
- shadcn/ui · next-intl · next-themes · Supabase
- Expo mobile app under [`mobile/`](./mobile/)

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The default locale is Arabic with RTL layout.

Mobile:

```bash
cd mobile
cp .env.example .env
npm install --legacy-peer-deps
npm start
```

## Troubleshooting

If `npm install` fails with `Cannot find module './selectors/root'`, the global npm installation is corrupted. Reinstall Node.js LTS from [nodejs.org](https://nodejs.org), or run install with a standalone npm:

```powershell
$temp = Join-Path $env:TEMP "npm-fix"
New-Item -ItemType Directory -Force -Path $temp | Out-Null
Invoke-WebRequest -Uri "https://registry.npmjs.org/npm/-/npm-11.6.0.tgz" -OutFile "$temp\npm.tgz"
tar -xzf "$temp\npm.tgz" -C $temp
node "$temp\package\bin\npm-cli.js" install
```

## Environment Variables

Copy `.env.example` to `.env.local` and set your Supabase project credentials. Prefer **one canonical feature-flag key** per feature (aliases remain accepted in code for backcompat). The middleware skips Supabase session refresh when these variables are not configured, so local UI development still works.

Validation checklist: [`docs/migration/env-checklist.md`](./docs/migration/env-checklist.md)

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check Prettier formatting |
| `npm run verify:foundation` | Sprint 0 structural migration checks |
| `npm run verify:mobile` | Mobile foundation invariants |
| `npm run verify:mobile-production` | Mobile production release checklist |

Archived manual/orphan scripts live under [`scripts/archive/`](./scripts/archive/README.md) (not wired in npm scripts).

## Project Structure

- `src/app/[locale]/(marketing)` — public landing pages
- `src/app/[locale]/(public)` — searchable public routes (legacy directory still present)
- `src/components` — UI and feature components
- `src/lib` — current runtime domain logic
- `src/domains` — SAD logical service boundaries (facades/skeletons; Sprint 0+)
- `mobile` — Expo Customer / Provider apps
- `messages` — Arabic and English translations
- `docs/migration` — official migration plan and checklists
- `supabase/migrations` — **schema source of truth**
- `scripts/archive` — low-risk archived verify/scratch tooling (Sprint 9.5)

## Immutable docs

- PSD invariants: `docs/product/psd-invariants.md`
- SAD boundaries: `docs/architecture/sad-boundaries.md`
- Migration report: `docs/migration/migration-report-v1.md`
- Roadmap: `docs/migration/roadmap.md`
