import type {
  CompletenessBreakdown,
  CompletenessSignal,
  SmartQuestion,
} from "@/lib/ai/decision/types";

type QuestionDef = {
  id: string;
  promptKey: string;
  fills: CompletenessSignal;
  priority: number;
  categories: string[] | "*";
  subcategories?: string[];
  /** If text matches, treat as already answered. */
  answeredIf?: RegExp;
};

/**
 * Dynamic question bank — only emit questions for missing signals,
 * filtered by category / subcategory. Never a fixed full questionnaire.
 */
const QUESTION_BANK: QuestionDef[] = [
  // Electrical
  {
    id: "elec_outage",
    promptKey: "smartQuestions.electrical.outage",
    fills: "scope",
    priority: 10,
    categories: ["electrical"],
    answeredIf: /outage|كهربا|انقطاع|power/i,
  },
  {
    id: "elec_whole",
    promptKey: "smartQuestions.electrical.wholeHome",
    fills: "scope",
    priority: 9,
    categories: ["electrical"],
    answeredIf: /whole|كامل|شقة|apartment|one room|غرفة واحدةحدة/i,
  },
  {
    id: "elec_fuse",
    promptKey: "smartQuestions.electrical.fuseChecked",
    fills: "ongoing_status",
    priority: 8,
    categories: ["electrical"],
    answeredIf: /fuse|فيوز|قاطع|breaker/i,
  },
  {
    id: "elec_photo",
    promptKey: "smartQuestions.common.photo",
    fills: "photo",
    priority: 5,
    categories: ["electrical"],
  },
  // Plumbing
  {
    id: "plumb_leak",
    promptKey: "smartQuestions.plumbing.leak",
    fills: "scope",
    priority: 10,
    categories: ["plumbing"],
    answeredIf: /leak|تسرب|سرب|flood|غرق/i,
  },
  {
    id: "plumb_where",
    promptKey: "smartQuestions.plumbing.where",
    fills: "scope",
    priority: 9,
    categories: ["plumbing"],
    answeredIf: /kitchen|مطبخ|toilet|مرحاض|bath|حمام|pipe|ماسورة/i,
  },
  {
    id: "plumb_running",
    promptKey: "smartQuestions.plumbing.stillRunning",
    fills: "ongoing_status",
    priority: 8,
    categories: ["plumbing"],
    answeredIf: /still|عم يسرب|لساتو|stopped|وقف|running/i,
  },
  {
    id: "plumb_photo",
    promptKey: "smartQuestions.common.photo",
    fills: "photo",
    priority: 5,
    categories: ["plumbing"],
  },
  // HVAC
  {
    id: "hvac_symptom",
    promptKey: "smartQuestions.hvac.symptom",
    fills: "scope",
    priority: 9,
    categories: ["hvac"],
    answeredIf: /cool|يبرد|noise|صوت|leak/i,
  },
  {
    id: "hvac_photo",
    promptKey: "smartQuestions.common.photo",
    fills: "photo",
    priority: 5,
    categories: ["hvac"],
  },
  // Locksmith
  {
    id: "lock_out",
    promptKey: "smartQuestions.locksmith.lockedOut",
    fills: "urgency",
    priority: 10,
    categories: ["locksmith"],
    answeredIf: /locked out|محبوس|برّا/i,
  },
  {
    id: "lock_break",
    promptKey: "smartQuestions.locksmith.breakOrLost",
    fills: "scope",
    priority: 8,
    categories: ["locksmith"],
    answeredIf: /broken|مكسور|lost|ضايع|key/i,
  },
  // Painting
  {
    id: "paint_indoor",
    promptKey: "smartQuestions.painting.indoorOutdoor",
    fills: "scope",
    priority: 8,
    categories: ["painting"],
    answeredIf: /indoor|outdoor|داخلي|خارجي/i,
  },
  {
    id: "paint_size",
    promptKey: "smartQuestions.painting.size",
    fills: "measurements",
    priority: 7,
    categories: ["painting"],
    answeredIf: /\d+\s*(m2|م|متر)|room|غرفة/i,
  },
  // Carpentry
  {
    id: "carp_item",
    promptKey: "smartQuestions.carpentry.item",
    fills: "scope",
    priority: 8,
    categories: ["carpentry"],
    answeredIf: /door|باب|cabinet|خزانة/i,
  },
  // Generic fallbacks
  {
    id: "common_photo",
    promptKey: "smartQuestions.common.photo",
    fills: "photo",
    priority: 4,
    categories: "*",
  },
  {
    id: "common_location",
    promptKey: "smartQuestions.common.area",
    fills: "location",
    priority: 3,
    categories: "*",
  },
];

const MAX_QUESTIONS = 4;

/**
 * Ask only what is missing — dynamic, category-aware, skip answered.
 */
export function buildSmartQuestions(input: {
  text: string;
  categorySlug: string | null;
  subcategory: string | null;
  completeness: CompletenessBreakdown;
}): SmartQuestion[] {
  const missing = new Set(input.completeness.missing);
  const category = input.categorySlug;

  const candidates = QUESTION_BANK.filter((q) => {
    if (!missing.has(q.fills)) return false;
    if (q.categories !== "*" && (!category || !q.categories.includes(category))) {
      return false;
    }
    if (
      q.subcategories &&
      input.subcategory &&
      !q.subcategories.includes(input.subcategory)
    ) {
      return false;
    }
    return true;
  });

  // Prefer category-specific over generic; de-dupe by fills.
  const sorted = [...candidates].sort((a, b) => {
    const aStar = a.categories === "*" ? 1 : 0;
    const bStar = b.categories === "*" ? 1 : 0;
    if (aStar !== bStar) return aStar - bStar;
    return b.priority - a.priority;
  });

  const seenFills = new Set<CompletenessSignal>();
  const out: SmartQuestion[] = [];

  for (const q of sorted) {
    if (seenFills.has(q.fills)) continue;
    const alreadyAnswered = q.answeredIf ? q.answeredIf.test(input.text) : false;
    if (alreadyAnswered) continue;
    seenFills.add(q.fills);
    out.push({
      id: q.id,
      promptKey: q.promptKey,
      fills: q.fills,
      priority: q.priority,
      alreadyAnswered: false,
    });
    if (out.length >= MAX_QUESTIONS) break;
  }

  return out;
}
