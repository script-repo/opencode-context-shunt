import { describe, expect, it } from "vitest"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createFilesystemCache, smartReadCacheKey } from "../../src/cache/filesystem.js"
import { smartRead } from "../../src/tools/smart-read.js"
import { DEFAULT_READ_THRESHOLDS } from "../../src/core/policy.js"

describe("filesystem cache", () => {
  it("round-trips get/set under hashed shard paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "ocs-cache-"))
    try {
      const cache = createFilesystemCache(root)
      expect(await cache.get("missing")).toBeUndefined()
      await cache.set("k1", '{"ok":true}')
      expect(await cache.get("k1")).toBe('{"ok":true}')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("smartRead semantic maps hit cache on unchanged content", async () => {
    const root = await mkdtemp(join(tmpdir(), "ocs-sr-cache-"))
    try {
      const cache = createFilesystemCache(root)
      const body = ["export function a() { return 1 }", "export class B {}"]
      while (body.length < 300) body.push(`// pad ${body.length}`)
      const content = body.join("\n")
      const opts = {
        content,
        cache,
        thresholds: { ...DEFAULT_READ_THRESHOLDS, direct_max_tokens: 100_000 },
      }
      const first = await smartRead("src/big.ts", opts)
      expect(first.type).toBe("semantic_file_map")
      if (first.type !== "semantic_file_map") return
      expect(first.cache_hit).toBeFalsy()

      const second = await smartRead("src/big.ts", opts)
      expect(second.type).toBe("semantic_file_map")
      if (second.type !== "semantic_file_map") return
      expect(second.cache_hit).toBe(true)
      expect(second.fingerprint).toBe(first.fingerprint)
      expect(second.symbols.map((s) => s.name)).toEqual(first.symbols.map((s) => s.name))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("smartReadCacheKey changes when fingerprint changes", () => {
    const a = smartReadCacheKey({ path: "a.ts", contentFingerprint: "aaa" })
    const b = smartReadCacheKey({ path: "a.ts", contentFingerprint: "bbb" })
    expect(a).not.toBe(b)
  })
})
