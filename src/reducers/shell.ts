import type { Reducer } from "./base.js"

export const shellReducer: Reducer = {
  name: "shell",
  async reduce() {
    throw new Error("shell reducer: not implemented")
  },
}
