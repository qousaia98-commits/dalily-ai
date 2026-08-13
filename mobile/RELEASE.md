# Dalily Mobile — Production Release Guide

## Environments

| Env | Bundle / Package | Channel | Config |
|-----|------------------|---------|--------|
| development | `app.dalily.mobile.dev` | development | `APP_ENV=development` |
| staging | `app.dalily.mobile.staging` | preview | `APP_ENV=staging` |
| production | `app.dalily.mobile` | production | `APP_ENV=production` |

Source of truth: `app.config.ts` + `eas.json`.

## Example production build

```bash
cd mobile
eas build --profile production --platform all
```

## Example TestFlight deployment

```bash
eas build --profile production --platform ios
eas submit --platform ios --profile production
# Then distribute via App Store Connect → TestFlight
```

## Example Google Play Internal release

```bash
eas build --profile production --platform android   # AAB
eas submit --platform android --profile internal
# Promote in Play Console: Internal → Closed → Production
```

## Example OTA update

```bash
eas update --channel production --message "Hotfix: booking deep link"
# Emergency rollback:
eas update:rollback --channel production
```

## Pre-submit checklist

```bash
npm run typecheck
npm run lint
npm run verify
npm run verify:production
npm run release:checklist
```

Capture store screenshots into `store/assets/screenshots/` before submission.
