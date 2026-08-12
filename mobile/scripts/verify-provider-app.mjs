/**
 * Sprint 9 Phase 3 — Provider Mobile App invariants.
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

console.log('══ Dalily Provider Mobile App invariants ══\n');

const required = [
  'app/(provider)/(tabs)/_layout.tsx',
  'app/(provider)/(tabs)/index.tsx',
  'app/(provider)/(tabs)/jobs.tsx',
  'app/(provider)/(tabs)/calendar.tsx',
  'app/(provider)/(tabs)/messages.tsx',
  'app/(provider)/(tabs)/profile.tsx',
  'app/(provider)/jobs/[id].tsx',
  'app/(provider)/assistant.tsx',
  'app/(provider)/analytics.tsx',
  'app/(provider)/availability.tsx',
  'features/provider/types.ts',
  'features/provider/services.ts',
  'features/provider/demo-data.ts',
  'features/provider/components/JobCard.tsx',
  'features/provider/components/MiniBars.tsx',
  'store/provider.ts',
];

for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

// The provider home screen defers entirely to the real web app (1:1 design
// and functionality) via WebAppShell — no native dashboard reimplementation
// to check for anymore.
const dash = read('app/(provider)/(tabs)/index.tsx');
if (dash.includes('WebAppShell')) ok('dashboard renders WebAppShell');
else fail('dashboard missing WebAppShell');
if (dash.includes("target=\"/business\"")) ok('dashboard targets /business');
else fail('dashboard missing /business target');

const assistant = read('app/(provider)/assistant.tsx');
if (
  assistant.includes('decideRecommendation') &&
  assistant.includes('briefing') &&
  assistant.includes('benchmark') &&
  assistant.includes('goals')
) {
  ok('business assistant integration');
} else fail('assistant incomplete');

const svc = read('features/provider/services.ts');
if (
  svc.includes('enqueueOfflineRequest') &&
  svc.includes('fetchProviderAiInsights') &&
  !svc.includes('marketplaceLiquidity') &&
  !svc.includes('fraudTrends')
) {
  ok('offline + provider-safe AI');
} else fail('services incomplete');

const jobs = read('app/(provider)/(tabs)/jobs.tsx');
if (jobs.includes('upcoming') && jobs.includes('rescheduled') && jobs.includes('updateJobStatus')) {
  ok('job management');
} else fail('jobs incomplete');

const cal = read('app/(provider)/(tabs)/calendar.tsx');
if (cal.includes('day') && cal.includes('week') && cal.includes('month') && cal.includes('workingHours')) {
  ok('calendar views');
} else fail('calendar incomplete');

const en = read('i18n/locales/en.json');
const ar = read('i18n/locales/ar.json');
if (en.includes('providerApp') && ar.includes('providerApp') && en.includes('openAssistant')) {
  ok('i18n providerApp');
} else fail('i18n incomplete');

if (failed) {
  console.error(`\n${failed} invariant(s) failed.`);
  process.exit(1);
}
console.log('\nAll provider mobile app invariants passed.');
