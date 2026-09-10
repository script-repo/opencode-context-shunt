import type { Reducer } from "./base.js"

export const observabilityReducer: Reducer = {
  name: "observability",
  async reduce() {
    throw new Error("observability reducer: not implemented")
  },
}
