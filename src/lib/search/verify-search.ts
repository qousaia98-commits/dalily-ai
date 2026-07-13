/**
 * Dalily Search MVP — verification helpers (no database required).
 */
import { ruleBasedProblemDetector } from "@/lib/search/problem-detection";
import { calculateDalilyScore } from "@/lib/search/ranking/dalily-score";
import type { Database } from "@/types/database.types";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

function makeProvider(overrides: Partial<ProviderRow>): ProviderRow {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    owner_id: "00000000-0000-4000-8000-000000000001",
    slug: "test-provider",
    name: { ar: "اختبار", en: "Test" },
    about: null,
    module_id: "a0000000-0000-4000-8000-000000000001",
    category_id: "c0000000-0000-4000-8000-000000000001",
    city_id: "b0000000-0000-4000-8000-000000000001",
    district_id: null,
    address_line: null,
    latitude: null,
    longitude: null,
    phone: null,
    whatsapp: null,
    email: null,
    website: null,
    cover_image_id: null,
    avatar_image_id: null,
    status: "active",
    verification_status: "verified",
    trust_score: 80,
    rating_avg: 4.5,
    review_count: 10,
    response_time_hours: 4,
    profile_completeness: 80,
    is_featured: false,
    featured_until: null,
    metadata: {},
    published_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    created_by: null,
    updated_by: null,
    ...overrides,
  };
}

export function verifySearchMvp(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];

  const cases: Array<{ query: string; expected: string }> = [
    { query: "My sink is leaking", expected: "water_leak" },
    { query: "المغسلة عم تسرب", expected: "water_leak" },
    { query: "Power is out", expected: "power_outage" },
    { query: "انقطاع التيار", expected: "power_outage" },
    { query: "My AC is not cooling", expected: "ac_not_cooling" },
    { query: "I am locked out", expected: "locked_out" },
    { query: "My washing machine is leaking", expected: "appliance_leak" },
  ];

  for (const testCase of cases) {
    const detected = ruleBasedProblemDetector.detect(testCase.query);
    if (detected.problem?.problemId !== testCase.expected) {
      failures.push(
        `Problem detection failed for "${testCase.query}" — expected ${testCase.expected}, got ${detected.problem?.problemId ?? "null"}`,
      );
    }
  }

  const highTrust = makeProvider({
    id: "00000000-0000-4000-8000-000000000001",
    trust_score: 95,
    verification_status: "verified",
    rating_avg: 4.9,
    profile_completeness: 95,
  });
  const lowTrust = makeProvider({
    id: "00000000-0000-4000-8000-000000000002",
    trust_score: 60,
    verification_status: "unverified",
    rating_avg: 3.5,
    profile_completeness: 50,
  });

  const highScore = calculateDalilyScore(highTrust, { priority: "emergency" });
  const lowScore = calculateDalilyScore(lowTrust, { priority: "emergency" });

  if (highScore <= lowScore) {
    failures.push("Dalily Score did not rank the stronger provider higher");
  }

  return { ok: failures.length === 0, failures };
}
