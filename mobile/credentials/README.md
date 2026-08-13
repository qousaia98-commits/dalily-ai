# Dalily Mobile — Code Signing

Production signing is managed by **EAS Credentials** (automatic). Local secret files are never committed.

## Android

| Item | Location / command |
|------|--------------------|
| Upload keystore | EAS managed (`eas credentials -p android`) |
| Google Play App Signing | Enabled in Play Console (Google holds the app signing key) |
| Service account (submit) | `credentials/android/google-play-service-account.json` (gitignored) |
| Rotation | Create new upload key → request Play Console reset → update EAS credentials |

### Local prep (optional)

```bash
eas credentials -p android
# Assign production keystore to the production profile
```

## iOS

| Item | Location / command |
|------|--------------------|
| Distribution certificate | EAS managed or Apple Developer portal |
| Provisioning profiles | App Store + Ad Hoc (preview) |
| Push (APNs) | EAS + Apple Push key |
| Rotation | Revoke old cert → `eas credentials -p ios` → rebuild |

```bash
eas credentials -p ios
eas build -p ios --profile production
eas submit -p ios --profile production
```

## Credential rotation checklist

1. Freeze new store submissions.
2. Rotate Android upload key or iOS distribution cert via EAS.
3. Rebuild production binaries.
4. Verify push + deep links still work.
5. Resume staged rollout at 5%.

## Gitignore

Never commit:

- `*.jks` / `*.keystore`
- `google-play-service-account.json`
- `AuthKey_*.p8`
- `credentials/**/*.json` (except `credentials/**/*.example.json`)
