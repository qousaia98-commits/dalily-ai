import type { ProblemId } from "@/lib/search/engine/types";
import type { DiagnosisDefinition } from "@/lib/diagnosis/types";

/**
 * Diagnosis Knowledge Base — 5 pilot problems only (the emergency/high-priority
 * entries in PROBLEM_CATALOG). Every other ProblemId has no entry here and
 * falls through to direct search, unchanged.
 *
 * resolveUrgency/resolvePossibleCause are hand-authored deterministic rules,
 * not AI calls — no LLM is involved once the initial problem is detected.
 */
export const DIAGNOSIS_CATALOG: Partial<Record<ProblemId, DiagnosisDefinition>> = {
  power_outage: {
    problemId: "power_outage",
    questions: [
      {
        id: "state",
        labelKey: "state",
        options: [
          { id: "off", labelKey: "off" },
          { id: "flickers", labelKey: "flickers" },
          { id: "breakerTripped", labelKey: "breakerTripped" },
          { id: "switchBroken", labelKey: "switchBroken" },
          { id: "unknown", labelKey: "unknown" },
        ],
      },
      {
        id: "smoke",
        labelKey: "smoke",
        options: [
          { id: "yes", labelKey: "yes" },
          { id: "no", labelKey: "no" },
        ],
        terminatesOn: ["yes"],
      },
      {
        id: "scope",
        labelKey: "scope",
        options: [
          { id: "one", labelKey: "one" },
          { id: "several", labelKey: "several" },
          { id: "entireHouse", labelKey: "entireHouse" },
        ],
        skipIf: (answers) => answers.state === "switchBroken",
      },
      {
        id: "sudden",
        labelKey: "sudden",
        options: [
          { id: "yes", labelKey: "yes" },
          { id: "no", labelKey: "no" },
        ],
      },
    ],
    resolveUrgency: (answers, basePriority) => {
      if (answers.smoke === "yes") return "emergency";
      if (answers.scope === "entireHouse") return "emergency";
      if (answers.state === "flickers" && answers.scope === "one") return "low";
      if (answers.state === "off" && answers.scope === "one") return "normal";
      return basePriority;
    },
    resolvePossibleCause: (answers) => {
      if (answers.smoke === "yes") return "wiringHazard";
      if (answers.state === "breakerTripped") return "breaker";
      if (answers.state === "switchBroken") return "switch";
      if (answers.state === "flickers") return "looseConnection";
      if (answers.state === "off") return "bulb";
      return null;
    },
  },

  water_leak: {
    problemId: "water_leak",
    questions: [
      {
        id: "location",
        labelKey: "location",
        options: [
          { id: "kitchen", labelKey: "kitchen" },
          { id: "bathroom", labelKey: "bathroom" },
          { id: "garden", labelKey: "garden" },
          { id: "other", labelKey: "other" },
        ],
      },
      {
        id: "amount",
        labelKey: "amount",
        options: [
          { id: "drops", labelKey: "drops" },
          { id: "constant", labelKey: "constant" },
          { id: "heavy", labelKey: "heavy" },
        ],
        terminatesOn: ["heavy"],
      },
      {
        id: "since",
        labelKey: "since",
        options: [
          { id: "today", labelKey: "today" },
          { id: "fewDays", labelKey: "fewDays" },
          { id: "longTime", labelKey: "longTime" },
        ],
      },
    ],
    resolveUrgency: (answers, basePriority) => {
      if (answers.amount === "heavy") return "emergency";
      if (answers.amount === "constant") return "high";
      if (answers.amount === "drops" && answers.since === "longTime") return "low";
      return basePriority;
    },
    resolvePossibleCause: (answers) => {
      if (answers.amount === "heavy") return "pipeBurst";
      if (answers.amount === "constant") return "wornWasher";
      if (answers.amount === "drops") return "looseFitting";
      return null;
    },
  },

  locked_out: {
    problemId: "locked_out",
    questions: [
      {
        id: "where",
        labelKey: "where",
        options: [
          { id: "home", labelKey: "home" },
          { id: "car", labelKey: "car" },
          { id: "office", labelKey: "office" },
        ],
      },
      {
        id: "reason",
        labelKey: "reason",
        options: [
          { id: "lostKey", labelKey: "lostKey" },
          { id: "brokenKey", labelKey: "brokenKey" },
          { id: "brokenLock", labelKey: "brokenLock" },
          { id: "lockedInside", labelKey: "lockedInside" },
        ],
        terminatesOn: ["lockedInside"],
      },
    ],
    resolveUrgency: (answers, basePriority) => {
      if (answers.reason === "lockedInside") return "emergency";
      return basePriority;
    },
    resolvePossibleCause: (answers) => {
      if (answers.reason === "lostKey") return "needsNewKey";
      if (answers.reason === "brokenKey") return "keyExtraction";
      if (answers.reason === "brokenLock") return "lockReplacement";
      if (answers.reason === "lockedInside") return "emergencyEntry";
      return null;
    },
  },

  vehicle_repair: {
    problemId: "vehicle_repair",
    questions: [
      {
        id: "engineStarts",
        labelKey: "engineStarts",
        options: [
          { id: "yes", labelKey: "yes" },
          { id: "no", labelKey: "no" },
        ],
      },
      {
        id: "batteryWarning",
        labelKey: "batteryWarning",
        options: [
          { id: "yes", labelKey: "yes" },
          { id: "no", labelKey: "no" },
        ],
        skipIf: (answers) => answers.engineStarts === "yes",
      },
      {
        id: "unusualSounds",
        labelKey: "unusualSounds",
        options: [
          { id: "yes", labelKey: "yes" },
          { id: "no", labelKey: "no" },
        ],
      },
    ],
    resolveUrgency: (answers, basePriority) => {
      if (answers.engineStarts === "no") return "high";
      if (answers.unusualSounds === "yes") return "high";
      return basePriority;
    },
    resolvePossibleCause: (answers) => {
      if (answers.engineStarts === "no" && answers.batteryWarning === "yes") return "deadBattery";
      if (answers.engineStarts === "no") return "starterOrFuel";
      if (answers.unusualSounds === "yes") return "mechanicalFault";
      return null;
    },
  },

  appliance_leak: {
    problemId: "appliance_leak",
    questions: [
      {
        id: "appliance",
        labelKey: "appliance",
        options: [
          { id: "washingMachine", labelKey: "washingMachine" },
          { id: "dishwasher", labelKey: "dishwasher" },
          { id: "fridge", labelKey: "fridge" },
          { id: "other", labelKey: "other" },
        ],
      },
      {
        id: "amount",
        labelKey: "amount",
        options: [
          { id: "drops", labelKey: "drops" },
          { id: "constant", labelKey: "constant" },
          { id: "heavy", labelKey: "heavy" },
        ],
        terminatesOn: ["heavy"],
      },
      {
        id: "recentRepair",
        labelKey: "recentRepair",
        options: [
          { id: "yes", labelKey: "yes" },
          { id: "no", labelKey: "no" },
        ],
      },
    ],
    resolveUrgency: (answers, basePriority) => {
      if (answers.amount === "heavy") return "high";
      return basePriority;
    },
    resolvePossibleCause: (answers) => {
      if (answers.recentRepair === "yes") return "installationIssue";
      if (answers.amount === "heavy") return "hoseOrValveFailure";
      return "wornSeal";
    },
  },
};
