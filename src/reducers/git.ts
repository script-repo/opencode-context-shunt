import type { Reducer } from "./base.js"
import { boundedReduce } from "./generic.js"

/** Git output reducer — bounded head/tail until a richer domain reducer lands. */
export const gitReducer: Reducer = {
  name: "git",
  async reduce(input) {
    const result = boundedReduce(input, 3200)
    return {
      ...result,
      metadata: { ...(result.metadata ?? {}), reducer: "git", thin: true },
    }
  },
}
