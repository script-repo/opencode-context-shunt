import type { Reducer, ReducerResult } from "./base.js"
import { estimateTokens } from "../core/tokenizer.js"

const DEFAULT_MAX_CHARS = 2400

export const genericReducer: Reducer = {
  name: "generic",
  async reduce(input) {
    return boundedReduce(input, DEFAULT_MAX_CHARS)
  },
}

export function boundedReduce(input: string, maxChars = DEFAULT_MAX_CHARS): ReducerResult {
  const tokensIn = estimateTokens(input)
  const lines = input.split(/\r?\n/)
  if (input.length <= maxChars) {
    return { summary: input, tokensIn, tokensOut: tokensIn }
  }
  const headBudget = Math.floor(maxChars * 0.7)
  const tailBudget = Math.floor(maxChars * 0.2)
  const head = input.slice(0, headBudget)
  const tail = input.slice(-tailBudget)
  const omitted = Math.max(
    0,
    lines.length - head.split(/\r?\n/).length - tail.split(/\r?\n/).length,
  )
  const summary =
    head +
    `\n…[ocs:generic omitted ~${omitted} lines / ${input.length - head.length - tail.length} chars]…\n` +
    tail
  return {
    summary,
    tokensIn,
    tokensOut: estimateTokens(summary),
    metadata: { omitted_lines: omitted, bounded: true },
  }
}
