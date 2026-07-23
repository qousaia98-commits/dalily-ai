/**
 * Opt-in verification for the LLM problem-detection fallback (paraphrasing,
 * German, code-switched input). Standalone (no path aliases, no extra deps),
 * mirrors verify-search.mjs's style. Skips cleanly when no API key is set —
 * safe to leave in the repo without requiring a live key in CI.
 */

const apiKey = process.env.SEARCH_LLM_API_KEY ?? process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.log("verify:search:llm skipped — set OPENAI_API_KEY (or SEARCH_LLM_API_KEY) to run.");
  process.exit(0);
}

const apiUrl = process.env.SEARCH_LLM_API_URL ?? "https://api.openai.com/v1/chat/completions";
const model = process.env.SEARCH_LLM_MODEL ?? "gpt-4o-mini";

const PROBLEM_GLOSSARY = {
  water_leak: "water leak or plumbing issue (pipe, sink, faucet, toilet)",
  power_outage: "electrical issue or power outage (no electricity, faulty wiring, broken light/lamp)",
  ac_not_cooling: "air conditioning / HVAC not cooling or not working",
  locked_out: "locked out of home or car, lost key, broken lock — needs a locksmith",
  appliance_leak: "home appliance broken or leaking (washing machine, dishwasher, fridge, dryer)",
  medical_need: "needs to see a doctor or medical clinic",
  legal_need: "needs a lawyer or legal advice",
  vehicle_repair: "car or vehicle mechanical repair",
  cleaning_need: "needs a home or office cleaner",
  dental_need: "dental problem, needs a dentist",
  pharmacy_need: "needs medicine or a pharmacy",
  tutoring_need: "needs a tutor or private lessons",
  restaurant_need: "looking for a restaurant or food",
  it_support_need: "computer, laptop, or wifi/IT problem",
  photography_need: "needs a photographer or photo shoot",
};

function buildSystemPrompt() {
  const lines = Object.entries(PROBLEM_GLOSSARY)
    .map(([id, gloss]) => `- ${id}: ${gloss}`)
    .join("\n");
  return [
    "You classify a local-services search query — spoken or typed, in any language or mix of languages — into exactly one category id.",
    "Categories:",
    lines,
    'Reply with exactly one category id from the list above, or "none" if nothing fits. No punctuation, quotes, or explanation — only the id.',
  ].join("\n");
}

async function classify(text) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: text },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content ?? "";
  return content.trim().toLowerCase().replace(/[^a-z_]/g, "");
}

const CASES = [
  { query: "بدي كهربجي لأن اللمبة خربانة", expected: "power_outage" },
  { query: "My sink is leaking", expected: "water_leak" },
  {
    query: "Ich brauche einen Elektriker. Die Sicherung fliegt ständig raus.",
    expected: "power_outage",
  },
  { query: "Need كهربجي بسرعة", expected: "power_outage" },
];

const failures = [];

for (const testCase of CASES) {
  try {
    const detected = await classify(testCase.query);
    if (detected === testCase.expected) {
      console.log(`PASS: "${testCase.query}" -> ${detected}`);
    } else {
      failures.push(`"${testCase.query}" — expected ${testCase.expected}, got ${detected || "none"}`);
      console.log(`FAIL: "${testCase.query}" -> ${detected || "none"} (expected ${testCase.expected})`);
    }
  } catch (error) {
    failures.push(`"${testCase.query}" — request error: ${error.message}`);
    console.log(`FAIL: "${testCase.query}" -> request error: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error(`\nverify:search:llm failed (${failures.length}/${CASES.length}).`);
  process.exit(1);
}

console.log("\nverify:search:llm passed.");
