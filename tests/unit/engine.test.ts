import { describe, expect, it } from "vitest"
import { createDefaultEngine } from "../../src/core/engine.js"

describe("createDefaultEngine", () => {
  it("pass-through decides pass for read", async () => {
    const engine = createDefaultEngine()
    const decision = await engine.decide({
      sessionId: "s1",
      tool: "read",
      operation: "execute",
      input: { path: "README.md" },
    })
    expect(decision.action).toBe("pass")
  })
})
