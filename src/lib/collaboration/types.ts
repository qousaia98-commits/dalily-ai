/** Sprint 5 Phase 5 — Collaboration Workspace types */

export type CollabTaskStatus = "todo" | "in_progress" | "blocked" | "completed";
export type CollabTaskPriority = "low" | "normal" | "high" | "urgent";

export type CollabTask = {
  id: string;
  projectId: string;
  packageId: string | null;
  title: string;
  description: string | null;
  status: CollabTaskStatus;
  priority: CollabTaskPriority;
  dueAt: string | null;
  assignedUserId: string | null;
  assignedRole: "customer" | "provider" | "admin" | "either" | null;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
};

export type CollabChecklistItem = {
  id: string;
  title: string;
  sortOrder: number;
  isDone: boolean;
  doneAt: string | null;
};

export type CollabChecklist = {
  id: string;
  projectId: string;
  packageId: string | null;
  templateSlug: string | null;
  title: string;
  status: "open" | "completed";
  items: CollabChecklistItem[];
  createdAt: string;
};

export type CollabApprovalKind =
  | "quotation"
  | "package_completed"
  | "additional_work"
  | "final_completion"
  | "other";

export type CollabApproval = {
  id: string;
  projectId: string;
  packageId: string | null;
  kind: CollabApprovalKind;
  title: string;
  description: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

export type CollabActivityEvent = {
  id: string;
  projectId: string;
  packageId: string | null;
  eventKey: string;
  labelEn: string;
  labelAr: string;
  actor: "system" | "customer" | "provider" | "admin" | "ai";
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type CollabProgress = {
  overallPct: number;
  packagesCompleted: number;
  packagesTotal: number;
  tasksOpen: number;
  tasksBlocked: number;
  tasksOverdue: number;
  approvalsPending: number;
  checklistsOpen: number;
  delayedPackages: number;
  blockedPackages: number;
};

export type CollabAiSummary = {
  summary: string;
  nextSteps: string[];
  risks: string[];
  missingDocuments: string[];
  aiGenerated: true;
};

export type CollaborationWorkspace = {
  projectId: string;
  progress: CollabProgress;
  tasks: CollabTask[];
  checklists: CollabChecklist[];
  approvals: CollabApproval[];
  activity: CollabActivityEvent[];
  templates: Array<{ slug: string; titleEn: string; titleAr: string }>;
};
