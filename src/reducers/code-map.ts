import type { Reducer } from "./base.js"
import { boundedReduce } from "./generic.js"

export const codeMapReducer: Reducer = {
  name: "code-map",
  async reduce(input) {
    const result = boundedReduce(input, 3200)
    return {
      ...result,
      metadata: { ...(result.metadata ?? {}), reducer: "code-map", thin: true },
    }
  },
}
