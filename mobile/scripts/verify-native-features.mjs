/**
 * Sprint 9 Phase 4 — Native Mobile Features invariants.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
let failed = 0;

function ok(m) {
  console.log(`✓ ${m}`);
}
function fail(m) {
  console.error(`✗ ${m}`);
  failed += 1;
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('══ Dalily Native Mobile Features invariants ══\n');

const required = [
  'features/native/index.ts',
  'features/native/types.ts',
  'features/native/permissions.ts',
  'features/native/push/service.ts',
  'features/native/push/preferences.ts',
  'features/native/push/history.ts',
  'features/native/push/deep-links.ts',
  'features/native/camera/service.ts',
  'features/native/media/picker.ts',
  'features/native/media/compress.ts',
  'features/native/location/service.ts',
  'features/native/maps/utils.ts',
  'features/native/navigation/open-maps.ts',
  'features/native/biometrics/service.ts',
  'features/native/files/service.ts',
  'features/native/offline-media/queue.ts',
  'features/native/share/service.ts',
  'features/native/device/prep.ts',
  'features/native/security/media-security.ts',
  'features/native/performance/cache.ts',
  'features/native/components/PermissionGate.tsx',
  'features/native/components/MediaPreviewList.tsx',
  'features/native/components/NativeMapView.tsx',
  'features/native/components/NativeFeaturesScreen.tsx',
  'features/native/components/NativeBootstrap.tsx',
  'app/(customer)/native.tsx',
  'app/(provider)/native.tsx',
];

for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const pkg = JSON.parse(read('package.json'));
for (const dep of [
  'expo-notifications',
  'expo-camera',
  'expo-image-picker',
  'expo-image-manipulator',
  'expo-location',
  'react-native-maps',
  'expo-document-picker',
  'expo-file-system',
  'expo-local-authentication',
  'expo-sharing',
  'expo-clipboard',
]) {
  if (pkg.dependencies?.[dep]) ok(`dep ${dep}`);
  else fail(`missing dep ${dep}`);
}

const env = read('constants/env.ts');
for (const flag of [
  'nativeFeatures',
  'nativePush',
  'nativeCamera',
  'nativeLocation',
  'nativeMaps',
  'nativeBiometrics',
  'nativeOfflineMedia',
]) {
  if (env.includes(flag)) ok(`flag ${flag}`);
  else fail(`flag missing ${flag}`);
}

const appJson = exists('app.config.ts') ? read('app.config.ts') : read('app.json');
for (const plugin of ['expo-notifications', 'expo-camera', 'expo-image-picker', 'expo-location']) {
  if (appJson.includes(plugin)) ok(`plugin ${plugin}`);
  else fail(`plugin missing ${plugin}`);
}

const push = read('features/native/push/service.ts');
if (push.includes('apns') && push.includes('fcm') && push.includes('silent')) {
  ok('push FCM/APNs + silent prep');
} else fail('push incomplete');

const perms = read('features/native/permissions.ts');
if (
  perms.includes('camera') &&
  perms.includes('photos') &&
  perms.includes('location') &&
  perms.includes('notifications') &&
  perms.includes('openPermissionSettings')
) {
  ok('centralized permissions');
} else fail('permissions incomplete');

const offline = read('features/native/offline-media/queue.ts');
if (
  offline.includes('retryMediaUpload') &&
  offline.includes('conflict') &&
  offline.includes('syncOfflineMediaQueue')
) {
  ok('offline media queue');
} else fail('offline media incomplete');

const job = read('app/(provider)/jobs/[id].tsx');
if (
  job.includes('openDefaultNavigation') &&
  job.includes('pickFromCamera') &&
  job.includes('enqueueMediaUpload')
) {
  ok('provider job native wiring');
} else fail('provider job missing native wiring');

const booking = read('app/(customer)/bookings/[id].tsx');
if (booking.includes('shareBookingDetails') && booking.includes('NativeMapView')) {
  ok('customer booking native wiring');
} else fail('customer booking missing native wiring');

const rootLayout = read('app/_layout.tsx');
if (rootLayout.includes('NativeBootstrap')) ok('NativeBootstrap mounted');
else fail('NativeBootstrap not mounted');

const future = read('constants/future.ts');
if (future.includes('ready: true') && future.includes('pushNotifications')) {
  ok('future capability registry updated');
} else fail('future registry incomplete');

console.log('');
if (failed) {
  console.error(`Failed: ${failed}`);
  process.exit(1);
}
console.log('All native feature invariants passed.');
