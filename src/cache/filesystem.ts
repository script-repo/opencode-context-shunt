import { createHash } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { CacheStore } from "./base.js"

function entryPath(root: string, key: string): string {
  const hex = createHash("sha256").update(key).digest("hex")
  return join(root, hex.slice(0, 2), `${hex}.json`)
}

/** Filesystem cache backend (SPEC §17). */
export function createFilesystemCache(root: string): CacheStore {
  return {
    async get(key: string): Promise<string | undefined> {
      try {
        return await readFile(entryPath(root, key), "utf8")
      } catch {
        return undefined
      }
    },
    async set(key: string, value: string): Promise<void> {
      const hex = createHash("sha256").update(key).digest("hex")
      const path = entryPath(root, key)
      await mkdir(join(root, hex.slice(0, 2)), { recursive: true })
      const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
      await writeFile(tmp, value, "utf8")
      await rename(tmp, path)
    },
  }
}

/** Stable Smart Read cache key — invalidates when content or reducer version changes. */
export function smartReadCacheKey(parts: {
  path: string
  contentFingerprint: string
  reducerId?: string
  schemaVersion?: string
}): string {
  return [
    "smart-read",
    parts.reducerId ?? "smart-read",
    parts.schemaVersion ?? "1",
    parts.path,
    parts.contentFingerprint,
  ].join("\0")
}
