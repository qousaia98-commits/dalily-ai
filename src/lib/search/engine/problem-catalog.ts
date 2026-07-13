import type { ServiceCategory } from "@/lib/constants/categories";
import type { ProblemId, ProblemPriority } from "@/lib/search/engine/types";

export type ProblemDefinition = {
  id: ProblemId;
  category: ServiceCategory;
  priority: ProblemPriority;
  /** All phrases (EN + AR) map to the same canonical ProblemId */
  keywords: string[];
};

/**
 * Canonical problem catalog.
 * Arabic and English phrases resolve to the same ProblemId.
 */
export const PROBLEM_CATALOG: ProblemDefinition[] = [
  {
    id: "water_leak",
    category: "plumber",
    priority: "emergency",
    keywords: [
      "my sink is leaking",
      "sink is leaking",
      "sink leaking",
      "water leak",
      "pipe leak",
      "leaking pipe",
      "faucet leak",
      "toilet leak",
      "المغسلة عم تسرب",
      "المغسلة تسرب",
      "تسريب ماء",
      "تسريب",
      "حوض",
      "مواسير",
      "حنفية",
      "سباك",
      "سباكة",
    ],
  },
  {
    id: "power_outage",
    category: "electrician",
    priority: "emergency",
    keywords: [
      "power is out",
      "power out",
      "no power",
      "blackout",
      "electricity is out",
      "انقطاع التيار",
      "انقطع التيار",
      "لا يوجد كهرباء",
      "كهربائي",
      "كهرباء",
      "تيار",
      "فيش",
    ],
  },
  {
    id: "ac_not_cooling",
    category: "mechanic",
    priority: "high",
    keywords: [
      "my ac is not cooling",
      "ac is not cooling",
      "not cooling",
      "air conditioner not cooling",
      "air conditioning",
      "hvac",
      "a/c",
      "ac repair",
      "المكيف ما بيبرد",
      "المكيف لا يبرد",
      "مكيف",
      "تكييف",
      "لا يبرد",
      "تبريد",
    ],
  },
  {
    id: "locked_out",
    category: "mechanic",
    priority: "emergency",
    keywords: [
      "i am locked out",
      "locked out",
      "lost my key",
      "broken lock",
      "door lock",
      "انغلقت",
      "انغلقت الباب",
      "قفال",
      "قفل",
      "مفتاح",
    ],
  },
  {
    id: "appliance_leak",
    category: "mechanic",
    priority: "high",
    keywords: [
      "my washing machine is leaking",
      "washing machine is leaking",
      "washing machine leak",
      "dishwasher leak",
      "appliance repair",
      "الغسالة عم تسرب",
      "غسالة",
      "تسرب الغسالة",
      "أجهزة",
      "ثلاجة",
      "dryer",
      "refrigerator",
    ],
  },
  {
    id: "medical_need",
    category: "doctor",
    priority: "normal",
    keywords: ["doctor", "physician", "medical", "clinic", "طبيب", "دكتور", "عيادة"],
  },
  {
    id: "legal_need",
    category: "lawyer",
    priority: "normal",
    keywords: ["lawyer", "attorney", "legal", "court", "محامي", "قانون"],
  },
  {
    id: "vehicle_repair",
    category: "mechanic",
    priority: "normal",
    keywords: ["mechanic", "car repair", "garage", "engine", "brake", "ميكانيكي", "سيارة"],
  },
  {
    id: "cleaning_need",
    category: "cleaner",
    priority: "low",
    keywords: ["cleaner", "cleaning", "maid", "housekeeping", "تنظيف", "منظف"],
  },
];

const PROBLEM_BY_ID = new Map(PROBLEM_CATALOG.map((problem) => [problem.id, problem]));

export function getProblemDefinition(id: ProblemId): ProblemDefinition {
  const problem = PROBLEM_BY_ID.get(id);
  if (!problem) throw new Error(`Unknown problem id: ${id}`);
  return problem;
}

export function categoryForProblem(id: ProblemId): ServiceCategory {
  return getProblemDefinition(id).category;
}

export function priorityForProblem(id: ProblemId): ProblemPriority {
  return getProblemDefinition(id).priority;
}
