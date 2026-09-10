import type { Reducer, ReducerResult } from "./base.js"
import { estimateTokens } from "../core/tokenizer.js"

export const genericReducer: Reducer = {
  name: "generic",
  async reduce(input) {
    const tokensIn = estimateTokens(input)
    const summary = input.slice(0, 800)
    return { summary, tokensIn, tokensOut: estimateTokens(summary) }
  },
}
