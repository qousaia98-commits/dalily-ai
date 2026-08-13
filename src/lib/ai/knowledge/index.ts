export type {
  KnowledgePhrase,
  KnowledgeLookupHit,
  KnowledgeFeedbackKind,
} from "./types";
export { lookupKnowledge } from "./lookup";
export {
  applyKnowledgeFeedback,
  upsertKnowledgeFromDetection,
} from "./feedback";
