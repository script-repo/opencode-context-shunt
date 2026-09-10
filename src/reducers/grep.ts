import type { Reducer } from "./base.js"
import { estimateTokens } from "../core/tokenizer.js"
import { boundedReduce } from "./generic.js"

export const grepReducer: Reducer = {
  name: "grep",
  async reduce(input) {
    const tokensIn = estimateTokens(input)
    const lines = input.split(/\r?\n/).filter((l) => l.length > 0)
    if (tokensIn <= 1200) {
      return { summary: input, tokensIn, tokensOut: tokensIn, metadata: { passthrough: true } }
    }
    const kept = lines.slice(0, 80)
    const omitted = Math.max(0, lines.length - kept.length)
    const summaryObj = {
      type: "grep_reduced",
      match_count: lines.length,
      matches: kept,
      omitted_matches: omitted,
      summary: `Kept ${kept.length}/${lines.length} match lines`,
    }
    const summary = JSON.stringify(summaryObj, null, 2)
    if (estimateTokens(summary) > 2500) {
      return { ...boundedReduce(summary, 7000), metadata: { reducer: "grep", nested_bound: true } }
    }
    return {
      summary,
      tokensIn,
      tokensOut: estimateTokens(summary),
      metadata: { reducer: "grep", omitted_matches: omitted },
    }
  },
}
