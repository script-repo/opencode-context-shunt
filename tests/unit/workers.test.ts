import { describe, expect, it } from "vitest"
import { runDeterministic } from "../../src/workers/deterministic.js"
import { runTransientModel } from "../../src/workers/transient-model.js"
import { routeWorker, selectTier } from "../../src/workers/router.js"

describe("workers", () => {
  it("T0 deterministic worker reduces large output without LLM", async () => {
    const big = Array.from({ length: 2000 }, (_, i) => `row ${i}`).join("\n")
    const out = await runDeterministic("reduce shell output", {
      input: big,
      metadata: { tool: "bash" },
    })
    expect(out.status).toBe("ok")
    if (out.status !== "ok") return
    expect(out.result.tier).toBe("T0")
    expect(out.result.output.length).toBeLessThan(big.length)
  })

  it("transient-model fail-safe escalates when generate ctx missing (no throw)", async () => {
    const out = await runTransientModel("summarize this", {})
    expect(out.status).toBe("escalate")
    if (out.status !== "escalate") return
    expect(out.reason.toLowerCase()).toMatch(/generate|ctx|fail-safe|unavailable/)
  })

  it("transient-model succeeds with injected generate", async () => {
    const out = await runTransientModel("hello", {
      generate: async () => "world",
      model: { providerID: "local", id: "slm" },
    })
    expect(out.status).toBe("ok")
    if (out.status !== "ok") return
    expect(out.result.output).toBe("world")
    expect(out.result.tier).toBe("T1")
  })

  it("router selectTier + routeWorker T0 path", async () => {
    expect(selectTier({ action: "compress", tier: "T0", reason: "x" })).toBe("T0")
    const out = await routeWorker({
      decision: { action: "compress", tier: "T0", reducer: "shell", reason: "x" },
      task: "reduce output",
      input: "ok",
    })
    expect(out.status).toBe("ok")
  })
})
