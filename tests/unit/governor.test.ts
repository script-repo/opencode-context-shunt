import { describe, expect, it } from "vitest"
import {
  applyBudget,
  DEFAULT_GOVERNOR_BUDGETS,
  governResult,
  resolveToolBudget,
} from "../../src/core/governor.js"
import { estimateTokens } from "../../src/core/tokenizer.js"

describe("applyBudget", () => {
  it("returns text unchanged when under budget", () => {
    const text = "hello world"
    expect(applyBudget(text, 1000)).toBe(text)
  })

  it("truncates over-budget text and appends marker", () => {
    const text = "abcd".repeat(500) // 2000 chars ≈ 500 tokens
    const out = applyBudget(text, 50)
    expect(out).not.toBe(text)
    expect(out).toContain("…[ocs: truncated by governor]")
    expect(out.length).toBeLessThan(text.length)
    const body = out.replace(/\n…\[ocs: truncated by governor\]$/, "")
    expect(estimateTokens(body)).toBeLessThanOrEqual(50 + 5)
  })

  it("prefers newline-boundary truncation when possible", () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line-${i}-xxxxxxxx`)
    const text = lines.join("\n")
    const out = applyBudget(text, 40)
    expect(out.endsWith("…[ocs: truncated by governor]")).toBe(true)
  })
})

describe("resolveToolBudget", () => {
  it("uses read / shell / default budgets", () => {
    expect(resolveToolBudget("read")).toBe(DEFAULT_GOVERNOR_BUDGETS.max_single_read_tokens)
    expect(resolveToolBudget("shell")).toBe(DEFAULT_GOVERNOR_BUDGETS.max_shell_result_tokens)
    expect(resolveToolBudget("bash")).toBe(DEFAULT_GOVERNOR_BUDGETS.max_shell_result_tokens)
    expect(resolveToolBudget("grep")).toBe(DEFAULT_GOVERNOR_BUDGETS.max_tool_result_tokens)
  })

  it("honors budget overrides", () => {
    expect(resolveToolBudget("read", { max_single_read_tokens: 123 })).toBe(123)
  })
})

describe("governResult", () => {
  it("reports truncation metadata", () => {
    const text = "x".repeat(20_000)
    const result = governResult({ tool: "shell", text })
    expect(result.budget).toBe(DEFAULT_GOVERNOR_BUDGETS.max_shell_result_tokens)
    expect(result.tokensIn).toBe(estimateTokens(text))
    expect(result.truncated).toBe(true)
    expect(result.text).toContain("…[ocs: truncated by governor]")
    expect(result.tokensOut).toBeLessThan(result.tokensIn)
  })

  it("does not truncate under budget", () => {
    const result = governResult({ tool: "read", text: "short" })
    expect(result.truncated).toBe(false)
    expect(result.text).toBe("short")
  })
})
