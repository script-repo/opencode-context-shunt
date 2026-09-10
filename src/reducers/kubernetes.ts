import type { Reducer } from "./base.js"

export const kubernetesReducer: Reducer = {
  name: "kubernetes",
  async reduce() {
    throw new Error("kubernetes reducer: not implemented")
  },
}
