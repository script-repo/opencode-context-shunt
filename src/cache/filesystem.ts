import type { CacheStore } from "./base.js"

export function createFilesystemCache(_root: string): CacheStore {
  return {
    async get() {
      return undefined
    },
    async set() {},
  }
}
