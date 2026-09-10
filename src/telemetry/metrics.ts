/** In-memory routing/telemetry counters and derived metrics (SPEC §21.1). */
import type { MetricsSnapshot, RouteAction, TelemetrySchema } from "../schemas/telemetry.js"

function emptyRoutesByAction(): Record<RouteAction, number> {
  return { pass: 0, compress: 0, offload: 0, cache: 0, block: 0, escalate: 0 }
}

function emptyMetrics(): TelemetrySchema {
  return {
    routes: 0,
    routesByAction: emptyRoutesByAction(),
    cacheHits: 0,
    cacheMisses: 0,
    escalations: 0,
    rawTokens: 0,
    returnedTokens: 0,
    workerInputTokens: 0,
    workerOutputTokens: 0,
    frontierTokensAvoided: 0,
    netTokensAvoided: 0,
    latencySamplesMs: [],
  }
}

/** Mutable counters singleton. Prefer the helpers below over direct mutation. */
export const counters: TelemetrySchema = emptyMetrics()

/** Reset all counters, primarily for test isolation. */
export function resetMetrics(): void {
  Object.assign(counters, emptyMetrics())
}

/** Record a cache hit. */
export function recordCacheHit(): void {
  counters.cacheHits += 1
}

/** Record a cache miss. */
export function recordCacheMiss(): void {
  counters.cacheMisses += 1
}

/** Record an escalation to a higher worker tier. */
export function recordEscalation(): void {
  counters.escalations += 1
}

export type TokenRecordInput = {
  rawTokens?: number
  returnedTokens?: number
  workerInputTokens?: number
  workerOutputTokens?: number
  frontierTokensAvoided?: number
}

/** Record token-flow counters for one routed operation. */
export function recordTokens(input: TokenRecordInput): void {
  const rawTokens = input.rawTokens ?? 0
  const returnedTokens = input.returnedTokens ?? 0
  const workerInputTokens = input.workerInputTokens ?? 0
  const workerOutputTokens = input.workerOutputTokens ?? 0
  const frontierTokensAvoided = input.frontierTokensAvoided ?? Math.max(0, rawTokens - returnedTokens)

  counters.rawTokens += rawTokens
  counters.returnedTokens += returnedTokens
  counters.workerInputTokens += workerInputTokens
  counters.workerOutputTokens += workerOutputTokens
  counters.frontierTokensAvoided += frontierTokensAvoided
  counters.netTokensAvoided += Math.max(
    0,
    frontierTokensAvoided - workerInputTokens - workerOutputTokens,
  )
}

/** Record one added-latency sample, in ms. Keeps at most the most recent 1000 samples. */
export function recordLatency(ms: number): void {
  counters.latencySamplesMs.push(ms)
  if (counters.latencySamplesMs.length > 1000) counters.latencySamplesMs.shift()
}

export type RouteRecordInput = {
  action: RouteAction
  cacheHit?: boolean
  escalated?: boolean
  rawTokens?: number
  returnedTokens?: number
  workerInputTokens?: number
  workerOutputTokens?: number
  frontierTokensAvoided?: number
  latencyMs?: number
}

/** Record one routed operation's counters (called by emit()). */
export function recordRoute(input: RouteRecordInput): void {
  counters.routes += 1
  counters.routesByAction[input.action] += 1

  if (input.cacheHit === true) recordCacheHit()
  else if (input.cacheHit === false) recordCacheMiss()

  if (input.escalated || input.action === "escalate") recordEscalation()

  recordTokens({
    rawTokens: input.rawTokens,
    returnedTokens: input.returnedTokens,
    workerInputTokens: input.workerInputTokens,
    workerOutputTokens: input.workerOutputTokens,
    frontierTokensAvoided: input.frontierTokensAvoided,
  })

  if (input.latencyMs != null) recordLatency(input.latencyMs)
}

/** Fraction of routed operations that were served from cache, in [0, 1]. */
export function cacheHitRate(): number {
  const total = counters.cacheHits + counters.cacheMisses
  return total === 0 ? 0 : counters.cacheHits / total
}

/** Fraction of routed operations that escalated, in [0, 1]. */
export function escalationRate(): number {
  return counters.routes === 0 ? 0 : counters.escalations / counters.routes
}

/** returnedTokens / rawTokens; lower is better compression. Returns 1 when no raw tokens seen. */
export function compressionRatio(): number {
  return counters.rawTokens === 0 ? 1 : counters.returnedTokens / counters.rawTokens
}

function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

/** Median added latency across recorded samples, in ms. */
export function medianLatencyMs(): number {
  return percentile(counters.latencySamplesMs, 50)
}

/** p95 added latency across recorded samples, in ms. */
export function p95LatencyMs(): number {
  return percentile(counters.latencySamplesMs, 95)
}

/** Point-in-time snapshot of all counters and derived metrics. */
export function snapshotMetrics(): MetricsSnapshot {
  return {
    ...counters,
    routesByAction: { ...counters.routesByAction },
    latencySamplesMs: [...counters.latencySamplesMs],
    cacheHitRate: cacheHitRate(),
    escalationRate: escalationRate(),
    compressionRatio: compressionRatio(),
    medianLatencyMs: medianLatencyMs(),
    p95LatencyMs: p95LatencyMs(),
  }
}
