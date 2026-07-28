/**
 * Sprint 9 Phase 1 — Mobile foundation invariants.
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

console.log('══ Dalily Mobile Foundation invariants ══\n');

const required = [
  'app/_layout.tsx',
  'app/index.tsx',
  'app/(auth)/login.tsx',
  'app/(auth)/register.tsx',
  'app/(auth)/forgot-password.tsx',
  'app/(customer)/(tabs)/index.tsx',
  'app/(provider)/(tabs)/index.tsx',
  'app/(admin)/index.tsx',
  'components/ui/Button.tsx',
  'components/ui/Card.tsx',
  'components/ui/Text.tsx',
  'components/ui/Input.tsx',
  'components/ui/Avatar.tsx',
  'components/ui/Badge.tsx',
  'components/ui/Modal.tsx',
  'components/ui/Loading.tsx',
  'api/client.ts',
  'services/auth/auth-service.ts',
  'services/offline/queue.ts',
  'services/offline/sync.ts',
  'store/auth.ts',
  'store/settings.ts',
  'store/offline.ts',
  'lib/secure-storage.ts',
  'lib/security.ts',
  'lib/observability.ts',
  'lib/supabase.ts',
  'theme/tokens.ts',
  'theme/ThemeProvider.tsx',
  'i18n/index.ts',
  'i18n/locales/en.json',
  'i18n/locales/ar.json',
  'providers/AppProviders.tsx',
  'constants/env.ts',
  'constants/future.ts',
  'navigation/linking.ts',
  'babel.config.js',
  'eslint.config.js',
  '.prettierrc',
  '.env.example',
];

for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const pkg = read('package.json');
for (const dep of [
  'expo-router',
  '@tanstack/react-query',
  'react-hook-form',
  'zod',
  'zustand',
  'expo-secure-store',
  'i18next',
  'eslint',
  'prettier',
  'husky',
]) {
  if (pkg.includes(`"${dep}"`)) ok(`dep ${dep}`);
  else fail(`missing dep ${dep}`);
}

const api = read('api/client.ts');
if (
  api.includes('refreshAccessToken') &&
  api.includes('queueIfOffline') &&
  api.includes('ApiError')
) {
  ok('api client capabilities');
} else fail('api client incomplete');

const auth = read('services/auth/auth-service.ts');
if (
  auth.includes('login') &&
  auth.includes('register') &&
  auth.includes('forgotPassword') &&
  auth.includes('logout') &&
  auth.includes('refreshSession')
) {
  ok('auth flows');
} else fail('auth incomplete');

const sec = read('lib/security.ts');
if (sec.includes('authenticateWithBiometrics') && sec.includes('certificatePinning')) {
  ok('security prep');
} else fail('security incomplete');

const obs = read('lib/observability.ts');
if (obs.includes('logApiMetric') && obs.includes('logNavigation') && obs.includes('logCrash')) {
  ok('observability');
} else fail('observability incomplete');

const future = read('constants/future.ts');
if (future.includes('pushNotifications') && future.includes('aiAssistant')) {
  ok('future-ready registry');
} else fail('future registry incomplete');

if (failed) {
  console.error(`\n${failed} invariant(s) failed.`);
  process.exit(1);
}
console.log('\nAll mobile foundation invariants passed.');
