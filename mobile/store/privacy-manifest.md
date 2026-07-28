# Privacy Manifest notes (iOS)

Configured in `app.config.ts` → `ios.privacyManifests`.

## Accessed API types declared

- UserDefaults — CA92.1 (app functionality)
- File timestamp — C617.1
- System boot time — 35F9.1
- Disk space — E174.1

## Collected data types declared

- Email address
- Precise location (opt-in)
- Photos (user-uploaded)
- Crash data

Tracking: **false** (no cross-app tracking domains).

Re-validate after adding any third-party SDK (Sentry, Maps, Analytics).
