/**
 * Vision domain adapters — AI Vision Bridge.
 */
export {
  visionModule,
  runVisionIntelligencePipeline,
  fuseTextAndVision,
  analyzeIntentVisionImage,
  parseIntentVisionAnalysis,
  getVisionAnalysisByHash,
  upsertVisionAnalysis,
  attachVisionAnalysisToRequest,
  confirmVisionAnalysis,
  getLatestVisionForRequest,
  compareVisionAnalysisOutcome,
  filterHighConfidenceObjects,
  filterHighConfidenceDamages,
  suggestToolsFromVision,
  suggestMaterialsFromVision,
  optimizeVisionImage,
  contentHashFromBytes,
  VISION_OBJECT_CATALOG,
  VISION_OBJECT_MIN_CONFIDENCE,
  VISION_DAMAGE_TYPES,
  VISION_DAMAGE_MIN_CONFIDENCE,
} from "@/lib/ai/vision";
