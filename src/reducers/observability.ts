import type { Reducer } from "./base.js"
import { boundedReduce } from "./generic.js"

export const observabilityReducer: Reducer = {
  name: "observability",
  async reduce(input) {
    const result = boundedReduce(input, 3200)
    return {
      ...result,
      metadata: { ...(result.metadata ?? {}), reducer: "observability", thin: true },
    }
  },
}
