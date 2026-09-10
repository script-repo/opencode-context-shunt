import type { Reducer } from "./base.js"

export const gitReducer: Reducer = {
  name: "git",
  async reduce() {
    throw new Error("git reducer: not implemented")
  },
}
