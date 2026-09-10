import type { Reducer } from "./base.js"

export const testsReducer: Reducer = {
  name: "tests",
  async reduce() {
    throw new Error("tests reducer: not implemented")
  },
}
