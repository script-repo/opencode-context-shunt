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
export { createFilesystemCache, smartReadCacheKey } from "./cache/filesystem.js"
export type { CacheStore } from "./cache/base.js"
export { applyOutputFirewall, selectReducer } from "./reducers/firewall.js"
export { boundedReduce, genericReducer } from "./reducers/generic.js"
export { shellReducer } from "./reducers/shell.js"
export { testsReducer } from "./reducers/tests.js"
export { grepReducer } from "./reducers/grep.js"
export { routeWorker, selectTier } from "./workers/router.js"
export { runDeterministic } from "./workers/deterministic.js"
export { runTransientModel } from "./workers/transient-model.js"
export type { Tier, WorkerResult, WorkerOutcome, WorkerRequest } from "./workers/base.js"
export {
  applyBudget,
  resolveToolBudget,
  governResult,
  DEFAULT_GOVERNOR_BUDGETS,
} from "./core/governor.js"
export type { GovernorBudgets, GovernResultInput, GovernResultOutput } from "./core/governor.js"
export { codeWrite } from "./tools/code-writer.js"
export type { CodeWriteArgs, CodeWriteResult } from "./tools/code-writer.js"
export { emit, setTelemetrySink } from "./telemetry/events.js"
export type { TelemetrySink } from "./telemetry/events.js"
export {
  counters,
  resetMetrics,
  recordRoute,
  cacheHitRate,
  escalationRate,
  compressionRatio,
  medianLatencyMs,
  p95LatencyMs,
  snapshotMetrics,
} from "./telemetry/metrics.js"
export {
  estimateCostUsd,
  calculateNetSavings,
  DEFAULT_COST_REGISTRY,
} from "./telemetry/costs.js"
export type { ModelCostRates, CostRegistry, NetSavingsInput, NetSavingsResult } from "./telemetry/costs.js"
export type {
  OcsTelemetryEvent,
  OcsEvent,
  TelemetrySchema,
  MetricsSnapshot,
  RouteAction,
} from "./schemas/telemetry.js"
