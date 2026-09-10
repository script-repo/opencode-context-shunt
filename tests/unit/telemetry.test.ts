import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  calculateNetSavings,
  DEFAULT_COST_REGISTRY,
  estimateCostUsd,
} from "../../src/telemetry/costs.js"
import { emit, setTelemetrySink } from "../../src/telemetry/events.js"
import {
  cacheHitRate,
  counters,
  medianLatencyMs,
  p95LatencyMs,
  resetMetrics,
  snapshotMetrics,
} from "../../src/telemetry/metrics.js"
import type { OcsTelemetryEvent } from "../../src/schemas/telemetry.js"

function baseEvent(partial: Partial<OcsTelemetryEvent> = {}): OcsTelemetryEvent {
  return {
    timestamp: "2026-09-09T20:00:00Z",
    tool: "read",
    route: "offload",
    ...partial,
  }
}

describe("telemetry", () => {
  beforeEach(() => {
    resetMetrics()
    setTelemetrySink(undefined)
    delete process.env.OCS_TELEMETRY_PATH
    delete process.env.OCS_DEBUG
  })

  afterEach(() => {
    setTelemetrySink(undefined)
    delete process.env.OCS_TELEMETRY_PATH
  })

  it("updates counters on emit", () => {
    emit(
      baseEvent({
        route: "offload",
        cache_hit: false,
        raw_estimated_tokens: 1000,
        returned_tokens: 100,
        frontier_tokens_avoided: 900,
        worker_input_tokens: 800,
        worker_output_tokens: 50,
        latency_ms: 120,
      }),
    )
    expect(counters.routes).toBe(1)
    expect(counters.routesByAction.offload).toBe(1)
    expect(counters.cacheMisses).toBe(1)
    expect(counters.rawTokens).toBe(1000)
    expect(counters.returnedTokens).toBe(100)
    expect(counters.frontierTokensAvoided).toBe(900)
    expect(counters.latencySamplesMs).toEqual([120])
  })

  it("writes JSONL via injectable sink", () => {
    const lines: string[] = []
    setTelemetrySink((line) => lines.push(line))
    emit(baseEvent({ route: "pass", cache_hit: true }))
    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0]) as OcsTelemetryEvent
    expect(parsed.tool).toBe("read")
    expect(parsed.route).toBe("pass")
    expect(counters.cacheHits).toBe(1)
    expect(cacheHitRate()).toBe(1)
  })

  it("appends JSONL to OCS_TELEMETRY_PATH", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ocs-tel-"))
    const path = join(dir, "events.jsonl")
    process.env.OCS_TELEMETRY_PATH = path
    try {
      emit(baseEvent({ route: "compress", latency_ms: 10 }))
      emit(baseEvent({ route: "compress", latency_ms: 30 }))
      const body = await readFile(path, "utf8")
      const lines = body.trim().split("\n")
      expect(lines).toHaveLength(2)
      expect(JSON.parse(lines[0]).route).toBe("compress")
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it("computes cost and net savings", () => {
    expect(estimateCostUsd(1_000_000, "provider/model-a", "input")).toBe(3)
    expect(estimateCostUsd(1_000_000, "provider/model-a", "output")).toBe(15)
    expect(estimateCostUsd(100, "missing-model")).toBe(0)

    const savings = calculateNetSavings({
      avoidedInputTokens: 1_000_000,
      frontierModelId: "provider/model-a",
      workerInputTokens: 100_000,
      workerOutputTokens: 10_000,
      workerModelId: "local/model-b",
      registry: {
        ...DEFAULT_COST_REGISTRY,
        "local/model-b": { input_per_million: 0.1, output_per_million: 0.2 },
      },
    })
    expect(savings.frontierCostAvoidedUsd).toBe(3)
    expect(savings.workerCostUsd).toBeCloseTo(0.1 * 0.1 + 0.01 * 0.2, 6)
    expect(savings.netSavingsUsd).toBeCloseTo(3 - savings.workerCostUsd, 6)
  })

  it("tracks latency percentiles and snapshot", () => {
    for (const ms of [10, 20, 30, 40, 100]) {
      emit(baseEvent({ route: "pass", latency_ms: ms, cache_hit: false }))
    }
    expect(medianLatencyMs()).toBe(30)
    expect(p95LatencyMs()).toBe(100)
    const snap = snapshotMetrics()
    expect(snap.routes).toBe(5)
    expect(snap.medianLatencyMs).toBe(30)
    expect(snap.p95LatencyMs).toBe(100)
    expect(snap.cacheHitRate).toBe(0)
  })
})
