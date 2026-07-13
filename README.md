# Dalily AI

AI-powered platform for discovering trusted local service providers in Syria.

## Stack

- Next.js 15 · TypeScript · Tailwind CSS v4
- shadcn/ui · next-intl · next-themes · Supabase

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The default locale is Arabic with RTL layout.

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

Copy `.env.example` to `.env.local` and set your Supabase project credentials. The middleware skips Supabase session refresh when these variables are not configured, so local UI development still works.

## Scripts

| Command              | Description              |
| -------------------- | ------------------------ |
| `npm run dev`        | Start development server |
| `npm run build`      | Production build         |
| `npm run start`      | Start production server  |
| `npm run lint`       | Run ESLint               |
| `npm run format`     | Format with Prettier     |
| `npm run format:check` | Check Prettier formatting |

## Project Structure

- `src/app/[locale]/(marketing)` — public landing pages
- `src/app/[locale]/(public)` — searchable public routes
- `src/components` — UI and feature components
- `src/lib` — i18n, Supabase, shared utilities
- `messages` — Arabic and English translations
