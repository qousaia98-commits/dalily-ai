import type { CategorySlug } from "@/lib/categories/types";
import type { ProblemId, ProblemPriority } from "@/lib/search/engine/types";

export type ProblemDefinition = {
  id: ProblemId;
  category: CategorySlug;
  priority: ProblemPriority;
  /** All phrases (EN + AR) map to the same canonical ProblemId */
  keywords: string[];
};

/**
 * Canonical problem catalog.
 * Arabic and English phrases resolve to the same ProblemId.
 * Category slugs reference leaf categories in the database.
 */
export const PROBLEM_CATALOG: ProblemDefinition[] = [
  {
    id: "water_leak",
    category: "plumbing",
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
    category: "electrical",
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
    category: "hvac",
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
    category: "locksmith",
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
    category: "appliance-repair",
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
    category: "doctors",
    priority: "normal",
    keywords: ["doctor", "physician", "medical", "clinic", "طبيب", "دكتور", "عيادة"],
  },
  {
    id: "legal_need",
    category: "lawyers",
    priority: "normal",
    keywords: ["lawyer", "attorney", "legal", "court", "محامي", "قانون"],
  },
  {
    id: "vehicle_repair",
    category: "auto-repair",
    priority: "normal",
    keywords: ["mechanic", "car repair", "garage", "engine", "brake", "ميكانيكي", "سيارة"],
  },
  {
    id: "cleaning_need",
    category: "cleaning",
    priority: "low",
    keywords: ["cleaner", "cleaning", "maid", "housekeeping", "تنظيف", "منظف"],
  },
  {
    id: "dental_need",
    category: "dentists",
    priority: "normal",
    keywords: ["dentist", "toothache", "dental", "أسنان", "طبيب أسنان", "وجع أسنان"],
  },
  {
    id: "pharmacy_need",
    category: "pharmacies",
    priority: "normal",
    keywords: ["pharmacy", "medicine", "prescription", "صيدلية", "دواء", "وصفة"],
  },
  {
    id: "tutoring_need",
    category: "tutors",
    priority: "low",
    keywords: ["tutor", "homework help", "private lesson", "مدرس خصوصي", "دروس خصوصية"],
  },
  {
    id: "restaurant_need",
    category: "restaurants",
    priority: "low",
    keywords: ["restaurant", "food delivery", "dining", "مطعم", "طعام", "أكل"],
  },
  {
    id: "it_support_need",
    category: "it-support",
    priority: "normal",
    keywords: [
      "computer repair",
      "laptop broken",
      "it support",
      "wifi not working",
      "حاسوب",
      "لابتوب",
      "دعم تقني",
    ],
  },
  {
    id: "photography_need",
    category: "photographer",
    priority: "low",
    keywords: ["photographer", "photo shoot", "wedding photos", "مصور", "تصوير", "صور"],
  },
];

const PROBLEM_BY_ID = new Map(PROBLEM_CATALOG.map((problem) => [problem.id, problem]));

export function getProblemDefinition(id: ProblemId): ProblemDefinition {
  const problem = PROBLEM_BY_ID.get(id);
  if (!problem) throw new Error(`Unknown problem id: ${id}`);
  return problem;
}

export function categoryForProblem(id: ProblemId): CategorySlug {
  return getProblemDefinition(id).category;
}

export function priorityForProblem(id: ProblemId): ProblemPriority {
  return getProblemDefinition(id).priority;
}
