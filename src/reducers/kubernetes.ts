import type { Reducer } from "./base.js"
import { boundedReduce } from "./generic.js"

/** Kubernetes CLI reducer — prefer unhealthy signals later; MVP is bounded. */
export const kubernetesReducer: Reducer = {
  name: "kubernetes",
  async reduce(input) {
    const result = boundedReduce(input, 3200)
    return {
      ...result,
      metadata: { ...(result.metadata ?? {}), reducer: "kubernetes", thin: true },
    }
  },
}
