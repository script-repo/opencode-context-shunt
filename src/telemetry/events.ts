/** Structured telemetry event emission (SPEC §21). */
import { appendFileSync } from "node:fs"
import type { OcsTelemetryEvent, RouteAction } from "../schemas/telemetry.js"
import { recordRoute } from "./metrics.js"

export type { OcsTelemetryEvent, RouteAction }

/** Injectable sink for tests / alternate transports. Receives one JSONL line per event. */
export type TelemetrySink = (line: string) => void

let sink: TelemetrySink | undefined

/** Install a sink that receives every emitted JSONL line instead of file/stderr output. */
export function setTelemetrySink(next: TelemetrySink | undefined): void {
  sink = next
}

function defaultWrite(line: string): void {
  const path = process.env.OCS_TELEMETRY_PATH
  if (path) {
    appendFileSync(path, line + "\n", "utf8")
    return
  }
  if (process.env.OCS_DEBUG) {
    console.error("[ocs]", line)
  }
}

/**
 * Emit a structured telemetry event: always updates in-memory counters, and
 * writes a JSONL line via the injected sink, OCS_TELEMETRY_PATH file, or
 * stderr (when OCS_DEBUG is set), in that order of preference.
 */
export function emit(event: OcsTelemetryEvent): void {
  const line = JSON.stringify(event)

  recordRoute({
    action: event.route,
    cacheHit: event.cache_hit,
    rawTokens: event.raw_estimated_tokens,
    returnedTokens: event.returned_tokens,
    workerInputTokens: event.worker_input_tokens,
    workerOutputTokens: event.worker_output_tokens,
    frontierTokensAvoided: event.frontier_tokens_avoided,
    latencyMs: event.latency_ms,
  })

  if (sink) {
    sink(line)
    return
  }
  defaultWrite(line)
}
