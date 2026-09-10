import type { Reducer } from "./base.js"

export const codeMapReducer: Reducer = {
  name: "code-map",
  async reduce() {
    throw new Error("code-map reducer: not implemented")
  },
}
