import { describe, expect, it } from "vitest"
import { estimateTokens } from "../../src/core/tokenizer.js"

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0)
  })

  it("approximates length/4", () => {
    expect(estimateTokens("abcd")).toBe(1)
    expect(estimateTokens("abcdefgh")).toBe(2)
  })
})
