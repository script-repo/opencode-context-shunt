export type { ContextShuntEngine, ShuntRequest, ShuntDecision } from "./core/engine.js"
export { createDefaultEngine } from "./core/engine.js"
export { classify } from "./core/classifier.js"
export { estimateTokens } from "./core/tokenizer.js"
export {
  loadPolicy,
  resolveReadThresholds,
  DEFAULT_READ_THRESHOLDS,
} from "./core/policy.js"
export type { OcsPolicy, ReadThresholds } from "./core/policy.js"
export { smartRead } from "./tools/smart-read.js"
export type {
  SmartReadResult,
  SmartReadOptions,
  SemanticFileMap,
  SmartReadContentResult,
} from "./tools/smart-read.js"
export { createOpenCodePlugin, createSmartReadTool } from "./adapters/opencode/plugin.js"
