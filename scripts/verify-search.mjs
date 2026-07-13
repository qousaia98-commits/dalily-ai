/**
 * Standalone Search MVP verification (no path aliases, no extra deps).
 * Keeps critical problem-detection and Dalily Score expectations in sync with the app.
 */

const PROBLEM_RULES = [
  {
    id: "water_leak",
    keywords: [
      "my sink is leaking",
      "sink is leaking",
      "المغسلة عم تسرب",
      "المغسلة تسرب",
      "تسريب",
    ],
  },
  {
    id: "power_outage",
    keywords: ["power is out", "power out", "انقطاع التيار", "انقطع التيار"],
  },
  {
    id: "ac_not_cooling",
    keywords: ["my ac is not cooling", "ac is not cooling", "المكيف لا يبرد"],
  },
  {
    id: "locked_out",
    keywords: ["i am locked out", "locked out", "انغلقت"],
  },
  {
    id: "appliance_leak",
    keywords: ["my washing machine is leaking", "washing machine is leaking", "الغسالة عم تسرب"],
  },
];

const DETECTION_CASES = [
  { query: "My sink is leaking", expected: "water_leak" },
  { query: "المغسلة عم تسرب", expected: "water_leak" },
  { query: "Power is out", expected: "power_outage" },
  { query: "انقطاع التيار", expected: "power_outage" },
  { query: "My AC is not cooling", expected: "ac_not_cooling" },
  { query: "I am locked out", expected: "locked_out" },
  { query: "My washing machine is leaking", expected: "appliance_leak" },
];

const WEIGHTS = {
  verification: 0.28,
  trustScore: 0.22,
  rating: 0.18,
  profileCompleteness: 0.17,
  recency: 0.1,
  urgencyAlignment: 0.05,
};

function normalizeSearchText(input) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreProblem(normalized, problemId) {
  const rule = PROBLEM_RULES.find((item) => item.id === problemId);
  if (!rule) return 0;

  let score = 0;
  for (const keyword of rule.keywords) {
    const nk = normalizeSearchText(keyword);
    if (nk.length < 2) continue;
    if (normalized.includes(nk)) {
      score += nk.includes(" ") ? 5 : 1;
    }
  }
  return score;
}

function detectProblem(query) {
  const normalized = normalizeSearchText(query);
  let best = null;

  for (const rule of PROBLEM_RULES) {
    const score = scoreProblem(normalized, rule.id);
    if (score > 0 && (!best || score > best.score)) {
      best = { id: rule.id, score };
    }
  }

  return best?.id ?? null;
}

function verificationScore(status) {
  if (status === "verified") return 1;
  if (status === "partially_verified") return 0.75;
  if (status === "pending") return 0.5;
  if (status === "unverified") return 0.25;
  return 0;
}

function calculateDalilyScore(provider, priority = null) {
  const urgencyWeight =
    priority === "emergency" || priority === "high" ? WEIGHTS.urgencyAlignment : 0;
  const scale = urgencyWeight === 0 ? 1 : (1 - WEIGHTS.urgencyAlignment) / (1 - WEIGHTS.urgencyAlignment);

  const trust = Math.min(1, Math.max(0, provider.trust_score / 100));
  const rating = Math.min(1, Math.max(0, provider.rating_avg / 5));
  const profile = Math.min(1, Math.max(0, provider.profile_completeness / 100));
  const recency = 0.8;

  const verifiedBoost = provider.verification_status === "verified" ? 1 : 0.3;
  const responseBoost =
    provider.response_time_hours == null
      ? 0.5
      : Math.max(0, 1 - provider.response_time_hours / 48);
  const urgencyAlignment = (verifiedBoost + responseBoost) / 2;

  return (
    WEIGHTS.verification * scale * verificationScore(provider.verification_status) +
    WEIGHTS.trustScore * scale * trust +
    WEIGHTS.rating * scale * rating +
    WEIGHTS.profileCompleteness * scale * profile +
    WEIGHTS.recency * scale * recency +
    urgencyWeight * urgencyAlignment
  );
}

const failures = [];

for (const testCase of DETECTION_CASES) {
  const detected = detectProblem(testCase.query);
  if (detected !== testCase.expected) {
    failures.push(
      `Problem detection failed for "${testCase.query}" — expected ${testCase.expected}, got ${detected ?? "null"}`,
    );
  }
}

const highScore = calculateDalilyScore(
  {
    verification_status: "verified",
    trust_score: 95,
    rating_avg: 4.9,
    profile_completeness: 95,
    response_time_hours: 2,
  },
  "emergency",
);

const lowScore = calculateDalilyScore(
  {
    verification_status: "unverified",
    trust_score: 60,
    rating_avg: 3.5,
    profile_completeness: 50,
    response_time_hours: 10,
  },
  "emergency",
);

if (highScore <= lowScore) {
  failures.push("Dalily Score did not rank the stronger provider higher");
}

if (failures.length > 0) {
  console.error("Search MVP verification failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("Search MVP verification passed.");
