/** Telemetry event and metrics schemas (SPEC §21). */

export type RouteAction = "pass" | "compress" | "offload" | "cache" | "block" | "escalate"
export type Tier = "T0" | "T1" | "T2" | "T3"
export type TokenCountKind = "estimated" | "provider_reported" | "tokenizer_exact"

/** A single routed-operation telemetry event (SPEC §21 example). */
export type OcsTelemetryEvent = {
  timestamp: string
  session_id?: string
  tool: string
  operation?: string
  route: RouteAction
  tier?: Tier
  reducer?: string
  raw_estimated_tokens?: number
  worker_input_tokens?: number
  worker_output_tokens?: number
  returned_tokens?: number
  frontier_tokens_avoided?: number
  latency_ms?: number
  cache_hit?: boolean
  model?: string
  confidence?: number
  /** SPEC §26 — how token fields were produced */
  token_count_kind?: TokenCountKind
}

/** Backward-compatible alias. */
export type OcsEvent = OcsTelemetryEvent

/** Snapshot of accumulated in-memory metrics (SPEC §21.1). */
export type TelemetrySchema = {
  routes: number
  routesByAction: Record<RouteAction, number>
  cacheHits: number
  cacheMisses: number
  escalations: number
  rawTokens: number
  returnedTokens: number
  workerInputTokens: number
  workerOutputTokens: number
  frontierTokensAvoided: number
  netTokensAvoided: number
  latencySamplesMs: number[]
}

/** Point-in-time snapshot returned by snapshotMetrics(): counters plus derived rates. */
export type MetricsSnapshot = TelemetrySchema & {
  cacheHitRate: number
  escalationRate: number
  compressionRatio: number
  medianLatencyMs: number
  p95LatencyMs: number
}
