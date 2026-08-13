# RC1 Fix: next-intl BaseLink Client Manifest

## Root cause

`src/lib/i18n/routing.ts` was a **barrel** that re-exported both:

1. `routing` (safe for middleware / Edge)
2. `Link`, `redirect`, `useRouter`, `usePathname`, `getPathname` from `createNavigation()`

`createNavigation()` pulls in `BaseLink` (a Client Component). When Server Components and the production RSC graph imported navigation APIs through that shared barrel, Next.js failed to resolve:

`next-intl/.../BaseLink.js#default` in the React Client Manifest

Follow-on symptom: `TypeError: a[d] is not a function`.

This matches the [next-intl App Router guidance](https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing): keep `routing` and `navigation` in separate modules; never share `createNavigation` with middleware.

## Why runtime failed (build still succeeded)

`next build` can complete while the production server (`next start`) hits the broken client/server boundary during SSR of pages that render `Link`. Playwright’s `webServer: next start` therefore crashed or returned 500s even though build was green.

## Fix

1. **`routing.ts`** — config only (`defineRouting`), no navigation exports.
2. **`navigation.ts`** — sole home of `createNavigation` / `Link` / hooks / `redirect`.
3. **`routing-config.ts`** — thin re-export of `routing` for existing middleware/request imports.
4. **160 call sites** — `Link` / `redirect` / hooks now import from `@/lib/i18n/navigation`.

## Files changed

- `src/lib/i18n/routing.ts`
- `src/lib/i18n/navigation.ts`
- `src/lib/i18n/routing-config.ts`
- ~160 app/components/hooks/actions imports (navigation path)
- `scripts/migrate-i18n-navigation-imports.mjs` (one-shot migrator)

## Verification

```
npm run build          # PASS (middleware 103 kB)
npx next start -p 3021 # /en /login /search → 200, no BaseLink errors
CI=true PLAYWRIGHT_PORT=3022 npx playwright test
                       # Playwright-owned next start → 30 passed, 1 skipped
```

## Why this resolves it

Middleware and Edge only load routing config. Client navigation (`BaseLink`) is only referenced through `@/lib/i18n/navigation`, so the React Client Manifest can register the module correctly under `next start`.
