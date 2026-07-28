/**
 * Sprint 9 Phase 2 — Customer Mobile App invariants.
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

console.log('══ Dalily Customer Mobile App invariants ══\n');

const required = [
  'app/(customer)/(tabs)/_layout.tsx',
  'app/(customer)/(tabs)/index.tsx',
  'app/(customer)/(tabs)/search.tsx',
  'app/(customer)/(tabs)/bookings.tsx',
  'app/(customer)/(tabs)/favorites.tsx',
  'app/(customer)/(tabs)/profile.tsx',
  'app/(customer)/categories/index.tsx',
  'app/(customer)/categories/[id].tsx',
  'app/(customer)/providers/[id].tsx',
  'app/(customer)/book/[providerId].tsx',
  'app/(customer)/bookings/[id].tsx',
  'app/(customer)/notifications.tsx',
  'features/customer/types.ts',
  'features/customer/services.ts',
  'features/customer/demo-data.ts',
  'features/customer/components/ProviderCard.tsx',
  'features/customer/components/CategoryChip.tsx',
  'features/customer/components/BookingListItem.tsx',
  'store/customer.ts',
];

for (const r of required) {
  if (exists(r)) ok(r);
  else fail(`missing ${r}`);
}

const home = read('app/(customer)/(tabs)/index.tsx');
for (const needle of [
  'popularCategories',
  'aiRecommendations',
  'recentlyViewed',
  'trending',
  'nearby',
  'RefreshControl',
]) {
  if (home.includes(needle)) ok(`home has ${needle}`);
  else fail(`home missing ${needle}`);
}

const book = read('app/(customer)/book/[providerId].tsx');
if (
  book.includes('selectService') &&
  book.includes('aiPrice') &&
  book.includes('BottomSheet') &&
  book.includes('submitBookingDraft')
) {
  ok('booking flow');
} else fail('booking flow incomplete');

const svc = read('features/customer/services.ts');
if (
  svc.includes('fetchCustomerAiInsights') &&
  !svc.includes('marketplaceLiquidity') &&
  !svc.includes('fraudTrends')
) {
  ok('customer-safe AI (no internal metrics)');
} else fail('AI safety incomplete');

const card = read('features/customer/components/ProviderCard.tsx');
if (
  card.includes('verified') &&
  card.includes('aiMatchScore') &&
  card.includes('toggleProvider')
) {
  ok('provider card fields');
} else fail('provider card incomplete');

const en = read('i18n/locales/en.json');
const ar = read('i18n/locales/ar.json');
if (en.includes('"tabs"') && ar.includes('"tabs"') && en.includes('"book"')) {
  ok('i18n customer keys');
} else fail('i18n incomplete');

if (failed) {
  console.error(`\n${failed} invariant(s) failed.`);
  process.exit(1);
}
console.log('\nAll customer mobile app invariants passed.');
