export { normalizeName, significantTokens, STOPWORDS } from "./normalize";
export {
  extractLocation,
  formatLocationLabel,
  LOCATION_PATTERNS,
  MEZZANINE_LOCATION_VALUE,
  ROOF_LOCATION_VALUE,
  type LocationMatch,
  type LocationPattern,
} from "./location";
export {
  SIMILARITY_THRESHOLD,
  bestMatchByTokens,
  jaccardSimilarity,
} from "./similarity";
export {
  EMPTY_DETECTION_DICTIONARY,
  lookupCorrection,
  rememberCorrection,
  type DetectionCorrection,
  type DetectionDictionary,
  type DetectionKind,
} from "./dictionary";
export {
  resolveSystem,
  type DetectionOrigin,
  type SystemResolution,
} from "./cascade";
export {
  resolveTaskLocation,
  type TaskLocationResult,
  type TaskLocationScope,
} from "./taskLocation";
export {
  getDetectionProvider,
  localDetectionProvider,
  setDetectionProvider,
  type DetectionProvider,
} from "./provider";
export {
  describeCoverage,
  summarizeDetection,
  type DetectionCoverage,
} from "./coverage";
