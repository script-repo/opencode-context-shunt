import { describe, expect, it } from "vitest"
import { applyOutputFirewall, selectReducer } from "../../src/reducers/firewall.js"
import { shellReducer } from "../../src/reducers/shell.js"
import { testsReducer } from "../../src/reducers/tests.js"
import { grepReducer } from "../../src/reducers/grep.js"

describe("output firewall", () => {
  it("selects shell/tests/grep reducers by tool name", () => {
    expect(selectReducer("bash").name).toBe("shell")
    expect(selectReducer("vitest").name).toBe("tests")
    expect(selectReducer("rg").name).toBe("grep")
  })

  it("passes through small outputs", async () => {
    const fw = await applyOutputFirewall({ tool: "bash", output: "ok\n" })
    expect(fw.reduced).toBe(false)
    expect(fw.text).toContain("ok")
  })

  it("reduces large shell output and preserves errors", async () => {
    const lines = Array.from({ length: 5000 }, (_, i) => `log line ${i}`)
    lines[100] = "Error: boom at src/app.ts:42"
    lines[101] = "exit_code: 1"
    const huge = lines.join("\n")
    const fw = await applyOutputFirewall({ tool: "bash", output: huge, maxRawTokens: 100 })
    expect(fw.reduced).toBe(true)
    expect(fw.reducer).toBe("shell")
    expect(fw.tokensOut).toBeLessThan(fw.tokensIn)
    expect(fw.text.toLowerCase()).toMatch(/error|failed|shell/)
  })

  it("shell reducer extracts material errors", async () => {
    const input = ["npm test", ...Array.from({ length: 2000 }, (_, i) => `line ${i}`), "Error: Expected 200, received 401", "exit code: 1"].join("\n")
    const result = await shellReducer.reduce(input)
    expect(result.tokensOut).toBeLessThan(result.tokensIn)
    expect(result.summary).toMatch(/material|failed|shell/i)
  })

  it("tests reducer keeps failure lines", async () => {
    const input = [
      "PASS ok.test.ts",
      ...Array.from({ length: 1500 }, (_, i) => `pad ${i}`),
      "FAIL auth.test.ts",
      "AssertionError: expected 200",
      "at tests/auth.test.ts:144",
    ].join("\n")
    const result = await testsReducer.reduce(input)
    expect(result.summary).toMatch(/auth|AssertionError|failed/i)
  })

  it("grep reducer bounds match volume", async () => {
    const input = Array.from({ length: 500 }, (_, i) => `src/f.ts:${i}: match ${i}`).join("\n")
    const result = await grepReducer.reduce(input)
    expect(result.tokensOut).toBeLessThan(result.tokensIn)
    expect(result.summary).toMatch(/match/i)
  })
})
